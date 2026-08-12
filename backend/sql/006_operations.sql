-- ---------------------------------------------------------------------
-- Everything the system needed to be run rather than demonstrated.
--
-- Additive and safe to re-run. The theme running through most of it is
-- the same: reference data that was baked into source files, and states
-- the schema allowed that no code could reach.
-- ---------------------------------------------------------------------

-- ---------- 1. reference catalogues ----------
-- Lab tests, imaging studies and the consultation tariff lived in a
-- TypeScript file, so repricing a test meant a code change and a
-- redeploy. A hospital reprices more often than it redeploys.

create table if not exists catalogue_items (
  id          bigserial primary key,
  kind        text not null check (kind in ('lab', 'imaging', 'tariff')),
  name        text not null,
  -- Imaging only. Null for the others.
  body_region text,
  price       numeric(10,2) not null check (price >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index if not exists catalogue_unique_name
  on catalogue_items (kind, name) where is_active;

create table if not exists departments (
  name       text primary key,
  is_active  boolean not null default true
);

-- ---------- 2. wards and beds as data ----------
-- ward_beds already holds a row per bed, but there was no way to add
-- one, and no notion of a bed being out of service for cleaning or
-- repair. A ward that cannot take a bed offline overstates its capacity.

alter table ward_beds
  add column if not exists is_available boolean not null default true;

alter table ward_beds
  add column if not exists out_of_service_reason text;

create table if not exists wards (
  name       text primary key,
  is_active  boolean not null default true
);

insert into wards (name)
  select distinct ward from ward_beds on conflict do nothing;

-- ---------- 3. doctor rosters ----------
-- free_slots() offered ten fixed times to every doctor, every day,
-- including weekends and including doctors on leave.

create table if not exists doctor_schedules (
  id           bigserial primary key,
  doctor_id    uuid not null references staff(id) on delete cascade,
  -- 0 = Sunday, matching extract(dow from date).
  day_of_week  int not null check (day_of_week between 0 and 6),
  starts_at    time not null,
  ends_at      time not null,
  slot_minutes int not null default 30 check (slot_minutes between 5 and 240),
  check (ends_at > starts_at)
);

create index if not exists schedule_by_doctor
  on doctor_schedules (doctor_id, day_of_week);

create table if not exists doctor_leave (
  id         bigserial primary key,
  doctor_id  uuid not null references staff(id) on delete cascade,
  starts_on  date not null,
  ends_on    date not null,
  reason     text,
  check (ends_on >= starts_on)
);

create index if not exists leave_by_doctor on doctor_leave (doctor_id, starts_on, ends_on);

-- ---------- 4. stock movements ----------
-- Quantities only ever fell, because dispensing was the only thing that
-- wrote to them. Every change now leaves a row saying who and why, which
-- is what makes a stock count auditable.

create table if not exists stock_movements (
  id           bigserial primary key,
  item_id      bigint not null references inventory_items(id) on delete cascade,
  -- received: a delivery. adjusted: a recount or a write-off.
  -- dispensed: recorded by dispense_prescription.
  kind         text not null check (kind in ('received', 'adjusted', 'dispensed')),
  -- Signed: negative for a write-off or a dispense.
  quantity     int not null check (quantity <> 0),
  reason       text,
  moved_by     uuid references staff(id),
  moved_at     timestamptz not null default now()
);

create index if not exists movements_by_item on stock_movements (item_id, moved_at desc);

-- ---------- 5. appointment lifecycle ----------
-- 'cancelled' existed in the enum and nothing could set it.

alter table appointments
  add column if not exists cancelled_reason text;

alter table appointments
  add column if not exists cancelled_by uuid references staff(id);

-- A no-show is not a cancellation: the slot was held and wasted, and
-- the distinction matters to anyone measuring clinic utilisation.
alter table appointments
  add column if not exists did_not_attend boolean not null default false;

-- ---------- 6. clinical corrections ----------
-- A signed note is not editable, and should not be. An addendum is how
-- a correction is made without rewriting what was originally recorded.

create table if not exists encounter_addenda (
  id           bigserial primary key,
  encounter_id bigint not null references encounters(id) on delete cascade,
  body         text not null check (length(trim(body)) > 0),
  author_id    uuid not null references staff(id),
  created_at   timestamptz not null default now()
);

create index if not exists addenda_by_encounter on encounter_addenda (encounter_id);

-- A vital can be superseded but never edited, for the same reason.
alter table vitals
  add column if not exists superseded_by bigint references vitals(id);

alter table vitals
  add column if not exists correction_note text;

-- Orders can be cancelled. The order stays; the reason is recorded.
alter table lab_orders
  add column if not exists cancelled_reason text;

alter table imaging_orders
  add column if not exists cancelled_reason text;

-- A rejected sample is a laboratory outcome, not an error state.
alter table lab_orders
  add column if not exists rejected_reason text;

alter table prescriptions
  add column if not exists discontinued_reason text;

alter table prescriptions
  add column if not exists discontinued_by uuid references staff(id);

-- ---------- 7. billing corrections ----------
-- Money moved in one direction only.

alter table invoices
  add column if not exists written_off numeric(10,2) not null default 0
    check (written_off >= 0);

create table if not exists payments (
  id          bigserial primary key,
  invoice_id  text not null references invoices(id) on delete cascade,
  -- Negative for a refund or a reversal, so the ledger sums correctly.
  amount      numeric(10,2) not null check (amount <> 0),
  method      text not null,
  provider    text,
  reason      text,
  taken_by    uuid references staff(id),
  taken_at    timestamptz not null default now()
);

create index if not exists payments_by_invoice on payments (invoice_id, taken_at desc);

alter table claims
  add column if not exists rejected_reason text;

-- ---------- 8. portal access and first sign-in ----------
-- A patient registered today could never sign in, because nothing
-- created an account for them. The application exists for them and they
-- could not reach it.

alter table users
  add column if not exists must_change_password boolean not null default false;

-- ---------- 9. staff notifications ----------
-- notifications could only be raised by the result-release trigger, so
-- there was no handover and no way to ask a colleague to look at
-- something. The table already supports staff_id; nothing wrote to it.
-- No schema change is needed here, only a route, which is the point
-- worth recording.

-- ---------- 10. partial dispensing ----------
-- Dispensing was all-or-nothing, so "we only have 20 of the 30" had no
-- answer and the pharmacist had to refuse the whole prescription.

alter table prescriptions
  add column if not exists dispensed_quantity int not null default 0
    check (dispensed_quantity >= 0);
