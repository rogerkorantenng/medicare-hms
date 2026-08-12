-- ================================================================
-- MediCare+ HMS — application functions
-- ================================================================
-- The operations that must be atomic, or that belong in the database
-- rather than in application code;
-- the only change is that the acting user arrives as a parameter now
-- that auth.uid() is gone.
--
-- No new tables. The 16-entity model from the submitted entity
-- relationship diagram is unchanged.

-- ---------- free slots ----------
-- Defect D-03 was caused by reading the roster and ignoring bookings
-- already made. This queries both.

create or replace function free_slots(p_doctor uuid, p_date date)
returns setof text language sql stable as $$
  select s.slot from unnest(array[
    '09:00','09:30','10:00','10:30','11:00','14:00','14:30','15:00','15:30','16:00'
  ]) as s(slot)
  where not exists (
    select 1 from appointments a
     where a.doctor_id = p_doctor and a.appt_date = p_date
       and a.appt_time = s.slot::time
       and a.status in ('confirmed','checked_in')
  );
$$;

-- ---------- register a patient ----------
-- The MRN is allocated by the database so two concurrent registrations
-- cannot collide.

create or replace function register_patient(
  p_actor uuid,
  p_full_name text, p_age int, p_sex char(1), p_phone text,
  p_blood_group text default null, p_allergies text[] default '{}',
  p_conditions text[] default '{}', p_insurance text default null
) returns patients language plpgsql as $$
declare v_row patients;
begin
  insert into patients (mrn, full_name, age, sex, phone, blood_group,
                        allergies, conditions, insurance)
  values (next_mrn(), p_full_name, p_age, p_sex, p_phone, p_blood_group,
          coalesce(p_allergies,'{}'), coalesce(p_conditions,'{}'), p_insurance)
  returning * into v_row;

  perform write_audit(p_actor, 'Registered patient', p_full_name);
  return v_row;
end $$;

-- ---------- the queue ----------
-- The entity model has no queue table and none is added. A queue entry
-- is a checked-in appointment: waiting until a nurse records vitals,
-- ready for the doctor afterwards. A walk-in is the same thing with
-- appt_type 'Walk-in'.

create or replace function add_walk_in(p_actor uuid, p_mrn text, p_doctor uuid default null)
returns bigint language plpgsql as $$
declare v_doctor uuid; v_id bigint; v_slot time;
begin
  v_doctor := coalesce(
    p_doctor,
    (select id from staff where role='doctor' and on_duty order by staff_no limit 1)
  );
  if v_doctor is null then
    raise exception 'No doctor is on duty to receive a walk-in.';
  end if;

  select s::time into v_slot from free_slots(v_doctor, current_date) s limit 1;
  if v_slot is null then
    raise exception 'That doctor has no free slot left today.';
  end if;

  insert into appointments (mrn, doctor_id, specialty, appt_date, appt_time, appt_type, status)
  values (p_mrn, v_doctor,
          (select department from staff where id = v_doctor),
          current_date, v_slot, 'Walk-in', 'checked_in')
  returning id into v_id;

  perform write_audit(p_actor, 'Added walk-in', p_mrn);
  return v_id;
end $$;

create or replace function check_in_appointment(p_actor uuid, p_appt bigint)
returns void language plpgsql as $$
declare v_mrn text;
begin
  update appointments set status = 'checked_in'
   where id = p_appt and status = 'confirmed'
  returning mrn into v_mrn;

  if v_mrn is null then
    raise exception 'Appointment % is not open for check-in.', p_appt;
  end if;
  perform write_audit(p_actor, 'Checked in patient', v_mrn);
end $$;

-- ---------- consultation ----------
-- Atomic. One signing stages a laboratory order, a prescription, an
-- invoice line, a timeline entry and possibly a referral, an admission
-- and a follow-up. All of it commits or none of it does, which is why
-- this is one function and not a sequence of client-side inserts.

create or replace function sign_encounter(p_doctor uuid, p jsonb)
returns bigint language plpgsql as $$
declare
  v_enc      bigint;
  v_mrn      text  := p->>'mrn';
  v_fee      numeric := coalesce((p->>'consultationFee')::numeric, 120.00);
  v_item     jsonb;
  v_name     text;
  v_ward     text;
  v_bed      text;
  v_spec     text;
  v_days     int;
  v_slot     time;
  v_ref_doc  uuid;
begin
  --  1. the encounter. The database rejects an empty diagnosis; this
  --     check exists only to give a better message than a constraint name.
  if coalesce(trim(p->>'diagnosis'), '') = '' then
    raise exception 'A diagnosis is required to sign a consultation.';
  end if;

  insert into encounters (mrn, doctor_id, complaint, diagnosis, notes, ai_assisted)
  values (v_mrn, p_doctor, coalesce(p->>'complaint',''), trim(p->>'diagnosis'),
          nullif(p->>'notes',''), coalesce((p->>'aiAssisted')::boolean, false))
  returning id into v_enc;

  --  2. staged laboratory orders
  for v_item in select * from jsonb_array_elements(coalesce(p->'labs','[]'::jsonb)) loop
    insert into lab_orders (mrn, encounter_id, ordered_by, test_name, priority, price)
    values (v_mrn, v_enc, p_doctor, v_item->>'testName',
            coalesce((v_item->>'priority')::priority_enum, 'routine'),
            coalesce((v_item->>'price')::numeric, 0));
  end loop;

  --  3. staged imaging
  for v_item in select * from jsonb_array_elements(coalesce(p->'imaging','[]'::jsonb)) loop
    insert into imaging_orders (mrn, encounter_id, ordered_by, modality, body_region, priority, price)
    values (v_mrn, v_enc, p_doctor, v_item->>'modality', v_item->>'bodyRegion',
            coalesce((v_item->>'priority')::priority_enum, 'routine'),
            coalesce((v_item->>'price')::numeric, 0));
  end loop;

  --  4. staged prescriptions
  for v_item in select * from jsonb_array_elements(coalesce(p->'prescriptions','[]'::jsonb)) loop
    insert into prescriptions (mrn, encounter_id, prescriber_id, drug, dose, frequency, duration, quantity)
    values (v_mrn, v_enc, p_doctor, v_item->>'drug', v_item->>'dose',
            v_item->>'frequency', v_item->>'duration',
            coalesce((v_item->>'quantity')::int, 1));
  end loop;

  --  5. admission
  if p->'admission' is not null and p->'admission' <> 'null'::jsonb then
    v_ward := p->'admission'->>'ward';
    v_bed  := p->'admission'->>'bedNo';
    update ward_beds set mrn = v_mrn, admitted_at = now()
     where ward = v_ward and bed_no = v_bed and mrn is null;
    if not found then
      raise exception 'Bed % in % is not free.', v_bed, v_ward;
    end if;
  end if;

  --  6. referral — a queue entry for the receiving specialty
  if p->'referral' is not null and p->'referral' <> 'null'::jsonb then
    v_spec := p->'referral'->>'specialty';
    select id into v_ref_doc from staff
     where role = 'doctor' and on_duty and department = v_spec
     order by staff_no limit 1;
    if v_ref_doc is not null then
      select s::time into v_slot from free_slots(v_ref_doc, current_date) s limit 1;
      if v_slot is not null then
        insert into appointments (mrn, doctor_id, specialty, appt_date, appt_time, appt_type, status)
        values (v_mrn, v_ref_doc, v_spec, current_date, v_slot, 'Referral', 'checked_in');
      end if;
    end if;
  end if;

  --  7. follow-up N days ahead
  v_days := nullif(p->>'followUpDays','')::int;
  if v_days is not null and v_days > 0 then
    select s::time into v_slot from free_slots(p_doctor, current_date + v_days) s limit 1;
    if v_slot is not null then
      insert into appointments (mrn, doctor_id, specialty, appt_date, appt_time, appt_type, status)
      values (v_mrn, p_doctor, (select department from staff where id = p_doctor),
              current_date + v_days, v_slot, 'Follow-up', 'confirmed');
    end if;
  end if;

  --  8. the consultation fee. Charge capture happens at the clinical
  --     event, not reconstructed later.
  perform add_invoice_line(v_mrn, 'Consultation', v_fee);

  --  9. audit
  select full_name into v_name from patients where mrn = v_mrn;
  perform write_audit(p_doctor, 'Signed consultation', coalesce(v_name, v_mrn));

  -- 10. clear the patient from the doctor's queue
  update appointments set status = 'completed'
   where mrn = v_mrn and doctor_id = p_doctor
     and appt_date = current_date and status = 'checked_in';

  update patients set last_visit = current_date where mrn = v_mrn;

  return v_enc;
end $$;

-- ---------- wards ----------

create or replace function admit_patient(p_actor uuid, p_mrn text, p_ward text, p_bed text)
returns void language plpgsql as $$
begin
  update ward_beds set mrn = p_mrn, admitted_at = now()
   where ward = p_ward and bed_no = p_bed and mrn is null;
  if not found then
    raise exception 'Bed % in % is not free.', p_bed, p_ward;
  end if;
  perform write_audit(p_actor, 'Admitted patient', p_mrn || ' to ' || p_ward || ' ' || p_bed);
end $$;

-- Discharge frees the bed AND writes the summary, in one transaction.
create or replace function discharge_patient(p_actor uuid, p_ward text, p_bed text)
returns void language plpgsql as $$
declare
  v_mrn text; v_admitted timestamptz; v_name text; v_dx text; v_body text;
begin
  select mrn, admitted_at into v_mrn, v_admitted
    from ward_beds where ward = p_ward and bed_no = p_bed for update;
  if v_mrn is null then
    raise exception 'Bed % in % is already free.', p_bed, p_ward;
  end if;

  select full_name into v_name from patients where mrn = v_mrn;
  select diagnosis  into v_dx  from encounters where mrn = v_mrn
   order by created_at desc limit 1;

  v_body :=
    'Ward: ' || p_ward || ' bed ' || p_bed || E'\n' ||
    'Admitted: ' || to_char(v_admitted, 'DD Mon YYYY HH24:MI') || E'\n' ||
    'Discharged: ' || to_char(now(), 'DD Mon YYYY HH24:MI') || E'\n' ||
    'Length of stay: ' || greatest(1, extract(day from now() - v_admitted)::int) || ' day(s)' || E'\n' ||
    'Working diagnosis: ' || coalesce(v_dx, 'not recorded') || E'\n' ||
    'Medication on discharge: ' ||
      coalesce((select string_agg(drug || ' ' || dose || ' ' || frequency, '; ')
                  from prescriptions where mrn = v_mrn and status = 'pending'), 'none');

  insert into documents (mrn, title, kind, body, created_by)
  values (v_mrn, 'Discharge summary — ' || to_char(now(),'DD Mon YYYY'),
          'Discharge summary', v_body, p_actor);

  update ward_beds set mrn = null, admitted_at = null
   where ward = p_ward and bed_no = p_bed;

  perform write_audit(p_actor, 'Discharged patient', coalesce(v_name, v_mrn));
end $$;

-- The medication round. There is no MAR table in the entity model and
-- none is added; an administration is recorded as an audit entry, which
-- is append-only and already the system's record of who did what.
create or replace function record_administration(p_actor uuid, p_rx bigint)
returns void language plpgsql as $$
declare v_drug text; v_mrn text; v_name text;
begin
  select r.drug, r.mrn, p.full_name into v_drug, v_mrn, v_name
    from prescriptions r join patients p on p.mrn = r.mrn
   where r.id = p_rx;
  if v_drug is null then
    raise exception 'Prescription % does not exist.', p_rx;
  end if;
  perform write_audit(p_actor, 'Administered medication',
                      coalesce(v_name, v_mrn) || ' — ' || v_drug || ' (rx ' || p_rx || ')');
end $$;

create or replace function medication_round()
returns table (
  prescription_id bigint, mrn text, patient_name text, ward text, bed_no text,
  drug text, dose text, frequency text, last_given_at timestamptz
) language sql stable as $$
  select r.id, r.mrn, p.full_name, b.ward, b.bed_no, r.drug, r.dose, r.frequency,
         (select max(a.occurred_at) from audit_entries a
           where a.action = 'Administered medication'
             and a.target like '%(rx ' || r.id || ')')
    from prescriptions r
    join ward_beds b on b.mrn = r.mrn
    join patients  p on p.mrn = r.mrn
   where r.status = 'pending'
   order by b.ward, b.bed_no, r.drug;
$$;

-- ---------- billing ----------
-- The audit entry must name the provider, e.g.
--   Payment recorded (MoMo · MTN MoMo) INV-2100

create or replace function record_payment(
  p_actor uuid, p_invoice text, p_amount numeric, p_method text, p_provider text default null
) returns void language plpgsql as $$
declare v_mrn text; v_name text; v_label text;
begin
  if p_amount <= 0 then
    raise exception 'A payment must be greater than zero.';
  end if;

  update invoices set paid = paid + p_amount where id = p_invoice
  returning mrn into v_mrn;
  if v_mrn is null then
    raise exception 'Invoice % does not exist.', p_invoice;
  end if;

  select full_name into v_name from patients where mrn = v_mrn;

  v_label := case when p_method = 'momo'
                  then 'Payment recorded (MoMo · ' || coalesce(p_provider,'unspecified') || ') ' || p_invoice
                  else 'Payment recorded (cash) ' || p_invoice end;
  perform write_audit(p_actor, v_label, coalesce(v_name, v_mrn));

  insert into notifications (mrn, kind, title, body)
  values (v_mrn, 'billing', 'Payment received',
          'We have recorded ' || to_char(p_amount, 'FM999999990.00') ||
          ' against ' || p_invoice || '.');
end $$;

create or replace function advance_claim(p_actor uuid, p_claim text)
returns void language plpgsql as $$
declare v_old claim_status; v_new claim_status;
begin
  select status into v_old from claims where id = p_claim for update;
  if v_old is null then
    raise exception 'Claim % does not exist.', p_claim;
  end if;
  v_new := case v_old when 'submitted' then 'authorised'
                      when 'authorised' then 'paid'
                      else null end;
  if v_new is null then
    raise exception 'Claim % is already paid.', p_claim;
  end if;

  update claims set status = v_new where id = p_claim;   -- trigger enforces forward-only
  perform write_audit(p_actor, 'Claim ' || v_new::text, p_claim);
end $$;

-- ---------- dashboard ----------
-- Assembled in the database so the operations copilot gets one snapshot
-- rather than the client making a dozen round trips and stitching them.

create or replace function hospital_snapshot()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'patientsTotal',      (select count(*) from patients),
    'wards',              (select coalesce(jsonb_agg(w), '[]'::jsonb) from (
                             select ward as name,
                                    count(*) filter (where mrn is not null) as occupied,
                                    count(*) as total
                               from ward_beds group by ward order by ward) w),
    'queueWaiting',       (select count(*) from appointments a
                            where a.status = 'checked_in' and a.appt_date = current_date
                              and not exists (select 1 from vitals v
                                               where v.mrn = a.mrn
                                                 and v.recorded_at::date = current_date)),
    'queueInTriage',      (select count(*) from appointments a
                            where a.status = 'checked_in' and a.appt_date = current_date
                              and exists (select 1 from vitals v
                                           where v.mrn = a.mrn
                                             and v.recorded_at::date = current_date)),
    'labsPending',        (select count(*) from lab_orders where status <> 'verified'),
    'rxPending',          (select count(*) from prescriptions where status = 'pending'),
    'revenueCollected',   (select coalesce(sum(paid),0) from invoices),
    'revenueOutstanding', (select coalesce(sum(total - paid),0) from invoices where total > paid),
    'staffOnDuty',        (select count(*) from staff where on_duty),
    'staffTotal',         (select count(*) from staff),
    'claims', jsonb_build_object(
      'submitted',  (select count(*) from claims where status='submitted'),
      'authorised', (select count(*) from claims where status='authorised'),
      'paid',       (select count(*) from claims where status='paid'))
  );
$$;

create or replace function dashboard_kpis()
returns jsonb language sql stable as $$
  select hospital_snapshot() || jsonb_build_object(
    'appointmentsToday', (select count(*) from appointments where appt_date = current_date),
    'bedsOccupied',      (select count(*) from ward_beds where mrn is not null),
    'bedsTotal',         (select count(*) from ward_beds),
    'imagingPending',    (select count(*) from imaging_orders where status <> 'reported'),
    'lowStockCount',     (select count(*) from inventory_items where quantity < reorder_level)
  );
$$;
