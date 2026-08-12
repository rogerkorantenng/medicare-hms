-- ---------------------------------------------------------------------
-- Functions for the operational features. Kept in the database for the
-- same reason as the others: a stock movement that updates a quantity
-- and writes a movement row must be one transaction, and a caller who
-- forgets the second half would leave the count unauditable.
-- ---------------------------------------------------------------------

-- ---------- free_slots, rebuilt ----------
-- The old version offered ten fixed times to every doctor, every day,
-- weekends included, whether or not they were on leave. This one reads
-- the roster, generates slots at the doctor's own interval, and removes
-- anything already booked.
--
-- A doctor with no roster row for that weekday gets no slots, which is
-- correct: not working is the default, and a schedule is a statement
-- that they are.

create or replace function free_slots(p_doctor uuid, p_date date)
returns setof text language sql stable as $$
  with on_leave as (
    select 1 from doctor_leave
     where doctor_id = p_doctor and p_date between starts_on and ends_on
  ),
  slots as (
    select to_char(
             generate_series(
               p_date + s.starts_at,
               p_date + s.ends_at - make_interval(mins => s.slot_minutes),
               make_interval(mins => s.slot_minutes)
             ), 'HH24:MI') as slot
      from doctor_schedules s
     where s.doctor_id = p_doctor
       and s.day_of_week = extract(dow from p_date)
       and not exists (select 1 from on_leave)
  )
  select slot from slots
   where not exists (
     select 1 from appointments a
      where a.doctor_id = p_doctor
        and a.appt_date = p_date
        and a.appt_time = slot::time
        and a.status in ('confirmed', 'checked_in')
   )
   order by slot;
$$;

-- ---------- stock ----------
-- One transaction: the quantity and the movement that explains it.

create or replace function move_stock(
  p_actor uuid, p_item bigint, p_kind text, p_quantity int, p_reason text default null
) returns int language plpgsql as $$
declare
  v_new int;
  v_name text;
begin
  if p_quantity = 0 then
    raise exception 'A movement of zero changes nothing.';
  end if;

  -- Read and lock first. Updating and then checking lets the table's own
  -- quantity >= 0 constraint fire, which refuses the movement correctly
  -- but reports it as a constraint violation naming an impossible row.
  -- A pharmacist counting boxes deserves the number they actually have.
  select quantity, name into v_new, v_name
    from inventory_items where id = p_item for update;

  if v_name is null then
    raise exception 'No such inventory item.';
  end if;

  if v_new + p_quantity < 0 then
    raise exception 'Only % of % in stock; that movement would take it below zero.',
      v_new, v_name;
  end if;

  update inventory_items
     set quantity = quantity + p_quantity
   where id = p_item
   returning quantity into v_new;

  insert into stock_movements (item_id, kind, quantity, reason, moved_by)
    values (p_item, p_kind, p_quantity, p_reason, p_actor);

  perform write_audit(
    p_actor,
    case p_kind
      when 'received' then 'Received stock (' || p_quantity || ')'
      when 'adjusted' then 'Adjusted stock (' || p_quantity || ')'
      else 'Stock movement (' || p_quantity || ')'
    end,
    v_name);

  return v_new;
end;
$$;

-- ---------- appointments ----------

create or replace function cancel_appointment(
  p_actor uuid, p_appointment bigint, p_reason text
) returns void language plpgsql as $$
declare
  v_mrn text;
begin
  update appointments
     set status = 'cancelled', cancelled_reason = p_reason, cancelled_by = p_actor
   where id = p_appointment and status in ('confirmed', 'checked_in')
   returning mrn into v_mrn;

  if v_mrn is null then
    raise exception 'That appointment cannot be cancelled. It may already be completed.';
  end if;

  perform write_audit(p_actor, 'Cancelled appointment (' || p_reason || ')', v_mrn);
end;
$$;

-- A no-show is recorded rather than cancelled: the slot was held and
-- wasted, and a clinic measuring utilisation needs to tell them apart.
create or replace function mark_did_not_attend(
  p_actor uuid, p_appointment bigint
) returns void language plpgsql as $$
declare
  v_mrn text;
begin
  update appointments
     set did_not_attend = true, status = 'completed'
   where id = p_appointment and status in ('confirmed', 'checked_in')
   returning mrn into v_mrn;

  if v_mrn is null then
    raise exception 'That appointment is not open.';
  end if;

  perform write_audit(p_actor, 'Recorded did not attend', v_mrn);
end;
$$;

-- ---------- beds ----------

create or replace function transfer_bed(
  p_actor uuid, p_mrn text, p_ward text, p_bed text
) returns void language plpgsql as $$
declare
  v_from text;
begin
  select ward || ' ' || bed_no into v_from from ward_beds where mrn = p_mrn;
  if v_from is null then
    raise exception 'That patient is not currently admitted.';
  end if;

  -- The partial unique index on mrn refuses two beds for one patient, so
  -- the old bed is freed first and both halves share a transaction.
  update ward_beds set mrn = null, admitted_at = null where mrn = p_mrn;

  update ward_beds
     set mrn = p_mrn, admitted_at = now()
   where ward = p_ward and bed_no = p_bed and mrn is null and is_available;

  if not found then
    raise exception 'Bed % in % is not free.', p_bed, p_ward;
  end if;

  perform write_audit(p_actor, 'Transferred from ' || v_from || ' to ' || p_ward || ' ' || p_bed, p_mrn);
end;
$$;

-- ---------- payments, refunds and write-offs ----------
-- invoices.paid is the running total the generated status column reads,
-- so every movement adjusts it and leaves a payments row behind.

create or replace function record_money(
  p_actor uuid, p_invoice text, p_amount numeric, p_method text,
  p_provider text default null, p_reason text default null
) returns void language plpgsql as $$
declare
  v_mrn text;
  v_paid numeric;
  v_total numeric;
begin
  select mrn, paid, total into v_mrn, v_paid, v_total from invoices where id = p_invoice;
  if v_mrn is null then
    raise exception 'No such invoice.';
  end if;

  if v_paid + p_amount < 0 then
    raise exception 'That would refund more than has been paid.';
  end if;

  update invoices set paid = paid + p_amount where id = p_invoice;

  insert into payments (invoice_id, amount, method, provider, reason, taken_by)
    values (p_invoice, p_amount, p_method, p_provider, p_reason, p_actor);

  perform write_audit(
    p_actor,
    case
      when p_amount > 0 then 'Payment recorded (' || p_method ||
             coalesce(' · ' || p_provider, '') || ') ' || p_invoice
      else 'Refund issued (' || coalesce(p_reason, p_method) || ') ' || p_invoice
    end,
    v_mrn);
end;
$$;

create or replace function write_off_invoice(
  p_actor uuid, p_invoice text, p_amount numeric, p_reason text
) returns void language plpgsql as $$
declare
  v_mrn text;
begin
  update invoices
     set written_off = written_off + p_amount, paid = paid + p_amount
   where id = p_invoice
   returning mrn into v_mrn;

  if v_mrn is null then
    raise exception 'No such invoice.';
  end if;

  perform write_audit(p_actor, 'Wrote off ' || p_amount || ' (' || p_reason || ') ' || p_invoice, v_mrn);
end;
$$;

-- ---------- portal access ----------
-- A patient registered at the desk could never sign in, because nothing
-- created an account for them.

create or replace function grant_portal_access(
  p_actor uuid, p_mrn text, p_email text, p_hash text
) returns uuid language plpgsql as $$
declare
  v_user uuid;
  v_name text;
begin
  select full_name into v_name from patients where mrn = p_mrn;
  if v_name is null then
    raise exception 'No patient with that MRN.';
  end if;

  if exists (select 1 from patients where mrn = p_mrn and user_id is not null) then
    raise exception 'That patient already has an account.';
  end if;

  insert into users (email, password_hash, role, must_change_password)
    values (lower(p_email), p_hash, 'patient', true)
    returning id into v_user;

  update patients set user_id = v_user where mrn = p_mrn;

  perform write_audit(p_actor, 'Granted patient application access', p_mrn);
  return v_user;
end;
$$;

-- ---------- dispensing, rebuilt ----------
-- The original took two arguments and returned void. Adding a third with
-- a default creates an overload rather than replacing it, and a two-
-- argument call then matches both, so Postgres refuses it as ambiguous.
-- The old signature has to go before the new one is defined.

drop function if exists dispense_prescription(bigint, uuid);

-- Two changes. It records a stock movement, so the ledger accounts for
-- every unit that leaves the shelf; and it accepts a quantity, so a
-- pharmacist with twenty of the thirty prescribed can give what they
-- have and leave the rest outstanding.

create or replace function dispense_prescription(
  p_rx_id bigint, p_staff uuid, p_quantity int default null
) returns int language plpgsql as $$
declare
  v_drug text; v_ordered int; v_given int; v_take int;
  v_item_id bigint; v_price numeric; v_mrn text;
begin
  select drug, quantity, dispensed_quantity, mrn
    into v_drug, v_ordered, v_given, v_mrn
    from prescriptions where id = p_rx_id and status = 'pending'
    for update;
  if not found then
    raise exception 'Prescription % is not pending.', p_rx_id;
  end if;

  v_take := coalesce(p_quantity, v_ordered - v_given);
  if v_take <= 0 then
    raise exception 'Nothing left to dispense on that prescription.';
  end if;
  if v_given + v_take > v_ordered then
    raise exception 'That is more than was prescribed. % of % already given.',
      v_given, v_ordered;
  end if;

  select id, unit_price into v_item_id, v_price
    from inventory_items where name = v_drug for update;
  if not found then
    raise exception 'Drug % is not in inventory.', v_drug;
  end if;

  -- The quantity >= 0 check on inventory_items fails here if short.
  update inventory_items
     set quantity = quantity - v_take, updated_at = now()
   where id = v_item_id;

  insert into stock_movements (item_id, kind, quantity, reason, moved_by)
    values (v_item_id, 'dispensed', -v_take, 'Prescription ' || p_rx_id, p_staff);

  update prescriptions
     set dispensed_quantity = v_given + v_take,
         status = case when v_given + v_take >= v_ordered then 'dispensed'::rx_status
                       else 'pending'::rx_status end,
         dispensed_by = p_staff,
         dispensed_at = case when v_given + v_take >= v_ordered then now()
                             else dispensed_at end
   where id = p_rx_id;

  perform add_invoice_line(v_mrn, v_drug || ' x' || v_take, v_price * v_take);
  return v_ordered - (v_given + v_take);
end $$;

-- ---------- discontinuing a prescription ----------
-- A drug prescribed in error could not be withdrawn. The row stays,
-- because it was really prescribed; the reason says why it stopped.

create or replace function discontinue_prescription(
  p_actor uuid, p_rx_id bigint, p_reason text
) returns void language plpgsql as $$
declare
  v_drug text; v_mrn text;
begin
  update prescriptions
     set status = 'dispensed', discontinued_reason = p_reason, discontinued_by = p_actor
   where id = p_rx_id and status = 'pending'
   returning drug, mrn into v_drug, v_mrn;

  if v_drug is null then
    raise exception 'That prescription is not pending.';
  end if;

  perform write_audit(p_actor, 'Discontinued ' || v_drug || ' (' || p_reason || ')', v_mrn);
end $$;

-- ---------- rejecting a sample ----------
-- The forward-only trigger is right about ordinary progress: a sample
-- cannot skip collection, and a result cannot be verified before it is
-- entered. It was wrong about one case.
--
-- When a laboratory rejects a sample as haemolysed, clotted or
-- mislabelled, the order genuinely returns to 'ordered' so a fresh
-- sample can be taken. That is not a stage going backwards by mistake;
-- it is the only correct way to record it. Without this the technician
-- either verifies a result they do not trust, or the order sits in
-- 'collected' forever against a sample that has been thrown away.
--
-- The exception is narrow: only to 'ordered', and only when a rejection
-- reason is being written in the same statement.

create or replace function lab_status_forward_only()
returns trigger language plpgsql as $$
declare oldpos int; newpos int;
begin
  if old.status = new.status then return new; end if;

  if new.status = 'ordered'
     and new.rejected_reason is not null
     and new.rejected_reason is distinct from old.rejected_reason then
    return new;
  end if;

  oldpos := array_position(
    array['ordered','collected','processing','resulted','verified']::text[], old.status::text);
  newpos := array_position(
    array['ordered','collected','processing','resulted','verified']::text[], new.status::text);
  if newpos <> oldpos + 1 then
    raise exception 'Illegal lab status transition: % to %. Stages advance one at a time.',
      old.status, new.status;
  end if;
  return new;
end $$;
