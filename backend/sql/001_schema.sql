-- ================================================================
-- MediCare+ HMS — PostgreSQL schema for AWS RDS
-- 16 entities, taken from the submitted entity relationship diagram
-- ================================================================
-- This is the Supabase schema ported to plain PostgreSQL. Two things
-- changed, and nothing else:
--
--   1. auth.users is gone. Supabase provided it; RDS does not. An
--      app-owned `users` table takes its place, carrying the password
--      hash that FastAPI verifies at sign-in.
--
--   2. Row-level security is not enabled. Authorisation now lives in
--      the FastAPI layer, which was a deliberate decision. Every
--      policy that used to live here has an equivalent role guard on
--      the route. See backend/app/security.py.
--
-- Everything that made the data trustworthy is unchanged: the
-- constraints, the forward-only state machines, the unique partial
-- indexes, the generated column, the atomic dispense, and the release
-- trigger. Those never depended on Supabase.
--
-- auth.uid() is also gone, so the functions that used it now take the
-- acting user as an explicit parameter. FastAPI passes it from the JWT.

-- ---------- enums ----------

create type role_enum as enum (
  'patient','doctor','nurse','receptionist','lab','radiology','pharmacist','cashier','admin'
);

create type lab_status as enum ('ordered','collected','processing','resulted','verified');
create type imaging_status as enum ('ordered','scheduled','scanned','reported');
create type rx_status as enum ('pending','dispensed');
create type appt_status as enum ('confirmed','checked_in','completed','cancelled');
create type claim_status as enum ('submitted','authorised','paid');
create type result_flag as enum ('normal','high','low','critical');
create type priority_enum as enum ('routine','stat');
create type acuity_enum as enum ('routine','semi_urgent','urgent');

create extension if not exists pgcrypto;

-- ---------- 0. users ----------
-- Replaces Supabase's auth.users. Password hashes are argon2, produced
-- and verified by the API; this table never sees a plaintext password.
-- A NULL hash means the account cannot be signed in to, which is how
-- the roster doctors exist as schedulable staff without being logins.

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text,
  role          role_enum not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index on users (lower(email));

-- ---------- 1. staff ----------

create table staff (
  id           uuid primary key references users(id) on delete cascade,
  staff_no     text unique not null,
  full_name    text not null,
  role         role_enum not null,
  department   text,
  on_duty      boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------- 2. patients ----------
-- MRN is the business key. Staff already speak in MRNs, so translating
-- between the system and the folder label would invite error.
-- Allergies and conditions are arrays because they are read on every
-- prescription safety check and never queried independently.

create table patients (
  mrn          text primary key,
  user_id      uuid unique references users(id) on delete set null,
  full_name    text not null,
  age          int  not null check (age >= 0 and age < 130),
  sex          char(1) not null check (sex in ('M','F')),
  phone        text not null,
  blood_group  text,
  allergies    text[] not null default '{}',
  conditions   text[] not null default '{}',
  insurance    text,
  last_visit   date,
  created_at   timestamptz not null default now()
);

create index on patients using gin (to_tsvector('simple', full_name));
create index on patients (last_visit desc);

-- MRN generator: PT-2xxxx, allocated by the database so two concurrent
-- registrations can never collide.
create sequence mrn_seq start 20600;
create or replace function next_mrn() returns text language sql as $$
  select 'PT-' || nextval('mrn_seq')::text;
$$;

-- ---------- 3. appointments ----------

create table appointments (
  id           bigserial primary key,
  mrn          text not null references patients(mrn) on delete cascade,
  doctor_id    uuid not null references staff(id),
  specialty    text,
  appt_date    date not null,
  appt_time    time not null,
  appt_type    text not null default 'Consultation',
  status       appt_status not null default 'confirmed',
  created_at   timestamptz not null default now()
);

-- One doctor cannot hold two live appointments in the same slot.
-- This is the double-booking defect (D-03) fixed at the data level.
create unique index appt_no_double_booking
  on appointments (doctor_id, appt_date, appt_time)
  where status in ('confirmed','checked_in');

create index on appointments (appt_date, appt_time);
create index on appointments (mrn);

-- ---------- 4. encounters ----------

create table encounters (
  id           bigserial primary key,
  mrn          text not null references patients(mrn) on delete cascade,
  doctor_id    uuid not null references staff(id),
  complaint    text not null,
  diagnosis    text not null check (length(trim(diagnosis)) > 0),
  notes        text,
  ai_assisted  boolean not null default false,
  created_at   timestamptz not null default now()
);

-- The not-null diagnosis check IS the "cannot sign without a diagnosis"
-- rule (defect D-07). Enforced in the API too, for a better message.

create index on encounters (mrn, created_at desc);

-- ---------- 5. vitals ----------

create table vitals (
  id           bigserial primary key,
  mrn          text not null references patients(mrn) on delete cascade,
  recorded_by  uuid not null references staff(id),
  systolic     int  check (systolic between 50 and 300),
  diastolic    int  check (diastolic between 30 and 200),
  temperature  numeric(3,1) check (temperature between 30 and 45),
  pulse        int  check (pulse between 20 and 250),
  spo2         int  check (spo2 between 50 and 100),
  weight_kg    numeric(5,1) check (weight_kg between 1 and 400),
  acuity       acuity_enum,
  recorded_at  timestamptz not null default now()
);

-- The range checks are the implausible-vitals rejection (TC-18).

create index on vitals (mrn, recorded_at desc);

-- ---------- 6. lab_orders ----------

create table lab_orders (
  id            bigserial primary key,
  mrn           text not null references patients(mrn) on delete cascade,
  encounter_id  bigint references encounters(id) on delete set null,
  ordered_by    uuid not null references staff(id),
  test_name     text not null,
  priority      priority_enum not null default 'routine',
  status        lab_status not null default 'ordered',
  result_value  text,
  ref_range     text,
  flag          result_flag,
  verified_by   uuid references staff(id),
  verified_at   timestamptz,
  price         numeric(10,2) not null default 0,
  created_at    timestamptz not null default now()
);

create index on lab_orders (status, priority desc, created_at);
create index on lab_orders (mrn);

-- Forward-only, one stage at a time. This is the guard behind TC-71.
create or replace function lab_status_forward_only()
returns trigger language plpgsql as $$
declare oldpos int; newpos int;
begin
  if old.status = new.status then return new; end if;
  oldpos := array_position(array['ordered','collected','processing','resulted','verified']::text[], old.status::text);
  newpos := array_position(array['ordered','collected','processing','resulted','verified']::text[], new.status::text);
  if newpos <> oldpos + 1 then
    raise exception 'Illegal lab status transition: % to %. Stages advance one at a time.', old.status, new.status;
  end if;
  if new.status = 'verified' then
    if new.result_value is null then
      raise exception 'Cannot verify a result with no value recorded.';
    end if;
    new.verified_at := now();
  end if;
  return new;
end $$;

create trigger trg_lab_forward before update on lab_orders
  for each row execute function lab_status_forward_only();

-- ---------- 7. imaging_orders ----------

create table imaging_orders (
  id            bigserial primary key,
  mrn           text not null references patients(mrn) on delete cascade,
  encounter_id  bigint references encounters(id) on delete set null,
  ordered_by    uuid not null references staff(id),
  modality      text not null,
  body_region   text,
  priority      priority_enum not null default 'routine',
  status        imaging_status not null default 'ordered',
  findings      text,
  reported_by   uuid references staff(id),
  price         numeric(10,2) not null default 0,
  created_at    timestamptz not null default now()
);

create index on imaging_orders (status, priority desc, created_at);
create index on imaging_orders (mrn);

-- ---------- 8. prescriptions ----------

create table prescriptions (
  id            bigserial primary key,
  mrn           text not null references patients(mrn) on delete cascade,
  encounter_id  bigint references encounters(id) on delete set null,
  prescriber_id uuid not null references staff(id),
  drug          text not null,
  dose          text not null,
  frequency     text not null,
  duration      text not null,
  quantity      int  not null default 1 check (quantity > 0),
  status        rx_status not null default 'pending',
  dispensed_by  uuid references staff(id),
  dispensed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index on prescriptions (status, created_at);
create index on prescriptions (mrn);

-- ---------- 9. inventory_items ----------

create table inventory_items (
  id            bigserial primary key,
  name          text not null unique,
  category      text,
  quantity      int  not null default 0 check (quantity >= 0),
  reorder_level int  not null default 0,
  unit_price    numeric(10,2) not null default 0,
  expiry_date   date,
  updated_at    timestamptz not null default now()
);

-- quantity >= 0 means an over-dispense fails rather than going negative.

-- ---------- 10. ward_beds ----------
-- The ERD collapses Ward and Bed into one table because a bed has no
-- identity apart from its ward.

create table ward_beds (
  ward         text not null,
  bed_no       text not null,
  mrn          text references patients(mrn) on delete set null,
  admitted_at  timestamptz,
  primary key (ward, bed_no)
);

-- A patient occupies at most one bed at a time.
create unique index bed_one_patient_only
  on ward_beds (mrn) where mrn is not null;

-- ---------- 11. invoices ----------

create table invoices (
  id           text primary key,
  mrn          text not null references patients(mrn) on delete cascade,
  total        numeric(10,2) not null default 0,
  paid         numeric(10,2) not null default 0 check (paid >= 0),
  status       text generated always as (
                 case when paid >= total and total > 0 then 'paid'
                      when paid > 0 then 'part_paid'
                      else 'unpaid' end
               ) stored,
  created_at   timestamptz not null default now()
);

-- status is a GENERATED column. It is derived from total and paid and can
-- never disagree with them after a partial payment.

create index on invoices (mrn);
create sequence invoice_seq start 2100;

-- ---------- 12. invoice_lines ----------
-- Separate table because a visit accumulates charges from several
-- departments at unpredictable times. Each department appends without
-- locking the invoice.

create table invoice_lines (
  id           bigserial primary key,
  invoice_id   text not null references invoices(id) on delete cascade,
  description  text not null,
  amount       numeric(10,2) not null,
  created_by   uuid references staff(id),
  created_at   timestamptz not null default now()
);

create index on invoice_lines (invoice_id);

-- Keep invoices.total in step with its lines.
create or replace function sync_invoice_total()
returns trigger language plpgsql as $$
begin
  update invoices
     set total = coalesce((select sum(amount) from invoice_lines
                            where invoice_id = coalesce(new.invoice_id, old.invoice_id)), 0)
   where id = coalesce(new.invoice_id, old.invoice_id);
  return null;
end $$;

create trigger trg_invoice_total
  after insert or update or delete on invoice_lines
  for each row execute function sync_invoice_total();

-- Charge capture. Called from the clinical event, not reconstructed later.
create or replace function add_invoice_line(p_mrn text, p_desc text, p_amount numeric)
returns void language plpgsql as $$
declare v_inv text;
begin
  select id into v_inv from invoices
   where mrn = p_mrn and paid < total
   order by created_at desc limit 1;

  if v_inv is null then
    v_inv := 'INV-' || nextval('invoice_seq')::text;
    insert into invoices (id, mrn) values (v_inv, p_mrn);
  end if;

  insert into invoice_lines (invoice_id, description, amount)
  values (v_inv, p_desc, p_amount);
end $$;

-- ---------- 13. claims ----------

create table claims (
  id            text primary key,
  invoice_id    text not null references invoices(id) on delete cascade,
  insurer       text not null,
  amount        numeric(10,2) not null,
  status        claim_status not null default 'submitted',
  justification text,
  updated_at    timestamptz not null default now()
);

-- Forward-only: submitted, authorised, paid.
create or replace function claim_status_forward_only()
returns trigger language plpgsql as $$
declare oldpos int; newpos int;
begin
  if old.status = new.status then return new; end if;
  oldpos := array_position(array['submitted','authorised','paid']::text[], old.status::text);
  newpos := array_position(array['submitted','authorised','paid']::text[], new.status::text);
  if newpos <= oldpos then
    raise exception 'Claim status cannot move backwards: % to %', old.status, new.status;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger trg_claim_forward before update on claims
  for each row execute function claim_status_forward_only();

-- ---------- 14. documents ----------

create table documents (
  id           bigserial primary key,
  mrn          text not null references patients(mrn) on delete cascade,
  title        text not null,
  kind         text not null,
  body         text,
  doc_date     date not null default current_date,
  created_by   uuid references staff(id),
  created_at   timestamptz not null default now()
);

create index on documents (mrn, doc_date desc);

-- ---------- 15. audit_entries ----------
-- Append-only. The API never exposes an update or a delete, and no
-- route exists that could. An audit trail that can be edited is not an
-- audit trail.

create table audit_entries (
  id           bigserial primary key,
  staff_id     uuid references staff(id),
  actor_name   text not null,
  action       text not null,
  target       text,
  occurred_at  timestamptz not null default now()
);

create index on audit_entries (occurred_at desc);

-- The acting user is passed explicitly now that auth.uid() is gone.
create or replace function write_audit(p_actor uuid, p_action text, p_target text)
returns void language plpgsql as $$
declare v_name text;
begin
  select full_name into v_name from staff where id = p_actor;
  insert into audit_entries (staff_id, actor_name, action, target)
  values (p_actor, coalesce(v_name, 'system'), p_action, p_target);
end $$;

-- ---------- 16. notifications ----------

create table notifications (
  id           bigserial primary key,
  mrn          text references patients(mrn) on delete cascade,
  staff_id     uuid references staff(id) on delete cascade,
  kind         text not null,
  title        text not null,
  body         text,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index on notifications (mrn, is_read, created_at desc);
create index on notifications (staff_id, is_read, created_at desc);

-- Result release and critical escalation. Fires on the verify transition
-- ONLY, never on result entry. This is defect D-04 fixed at the data level:
-- nothing reaches the doctor or the patient until a technician verifies.
create or replace function release_verified_result()
returns trigger language plpgsql as $$
begin
  if new.status = 'verified' and old.status <> 'verified' then
    insert into notifications (mrn, kind, title, body)
    values (new.mrn, 'result', 'Result ready',
            new.test_name || ' has been verified. Tap Records to view.');

    insert into notifications (staff_id, kind, title, body)
    values (new.ordered_by,
            case when new.flag = 'critical' then 'critical' else 'result' end,
            case when new.flag = 'critical'
                 then 'CRITICAL RESULT: ' || new.test_name
                 else 'Result verified: ' || new.test_name end,
            coalesce(new.result_value,'') || ' (ref ' || coalesce(new.ref_range,'n/a') || ')');

    perform add_invoice_line(new.mrn, new.test_name, new.price);
  end if;
  return new;
end $$;

create trigger trg_release_result after update on lab_orders
  for each row execute function release_verified_result();

-- ---------- dispensing ----------
-- Decrements stock atomically, from current state, not from a copy the
-- client held. This is defect D-05 fixed properly.

create or replace function dispense_prescription(p_rx_id bigint, p_staff uuid)
returns void language plpgsql as $$
declare
  v_drug text; v_qty int; v_item_id bigint; v_price numeric;
begin
  select drug, quantity into v_drug, v_qty
    from prescriptions where id = p_rx_id and status = 'pending'
    for update;
  if not found then
    raise exception 'Prescription % is not pending.', p_rx_id;
  end if;

  select id, unit_price into v_item_id, v_price
    from inventory_items where name = v_drug for update;
  if not found then
    raise exception 'Drug % is not in inventory.', v_drug;
  end if;

  update inventory_items
     set quantity = quantity - v_qty, updated_at = now()
   where id = v_item_id;   -- the quantity >= 0 check fails here if short

  update prescriptions
     set status = 'dispensed', dispensed_by = p_staff, dispensed_at = now()
   where id = p_rx_id;

  perform add_invoice_line(
    (select mrn from prescriptions where id = p_rx_id),
    v_drug || ' x' || v_qty,
    v_price * v_qty
  );
end $$;
