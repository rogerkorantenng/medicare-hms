-- ================================================================
-- MediCare+ HMS — Row-level security
-- Migration step 2 of 6. THE MOST IMPORTANT FILE IN THIS HANDOFF.
-- ================================================================
-- This is what turns "role-based access" from a UI convention into an
-- enforced guarantee. In v1.0 authorisation lived in the application, and
-- the submitted documentation names that as the system's honest weakness.
-- These policies close it.
--
-- Run AFTER schema.sql. Verification queries are at the bottom and are
-- the acceptance criterion for step 2 — do not proceed to step 3 until
-- they all pass.

-- ---------- role claim in the JWT ----------
-- Supabase Auth issues the JWT. We copy the staff role into it so
-- policies can read the role without a subquery on every row.

-- DEVIATION FROM THE HANDOFF, flagged rather than made silently.
--
-- These four helpers shipped as plain SQL functions. That does not work,
-- and it fails the same way on Supabase as it does locally:
--
--   ERROR: stack depth limit exceeded
--   CONTEXT: SQL function "jwt_role" during inlining
--            SQL function "is_staff" during inlining
--            SQL function "jwt_role" during startup   (x many)
--
-- Why. Postgres inlines plain SQL functions. jwt_role() falls back to
-- "select role from staff where id = auth.uid()". Planning that subquery
-- applies staff's own policy, which calls is_staff(), which calls
-- jwt_role(), which plans the same subquery again, without bound. The
-- COALESCE does not save it: COALESCE short-circuits at EXECUTION, but
-- the planner must still PLAN the second branch, and it is planning that
-- recurses. Every authenticated query against every table hits this,
-- because every policy on every table calls one of these helpers.
--
-- Fix: SECURITY DEFINER with a pinned search_path. This is the pattern
-- Supabase documents for exactly this problem. It breaks the cycle twice
-- over — a SECURITY DEFINER function is never inlined, and the staff
-- lookup runs as the function owner, so it does not re-enter row-level
-- security at all.
--
-- Nothing about the authorisation MODEL changes. Same roles, same reads,
-- same refusals. my_mrn() still returns only the caller's own MRN,
-- because it is keyed on auth.uid(). The submitted design documents
-- describe the policy model, not the function volatility, so no document
-- needs amending for this.

create or replace function public.jwt_role() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', ''),
    (select role::text from staff where id = auth.uid())
  );
$$;

create or replace function public.is_clinical() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.jwt_role() in ('doctor','nurse','lab','radiology','pharmacist','admin');
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.jwt_role() in
    ('doctor','nurse','receptionist','lab','radiology','pharmacist','cashier','admin');
$$;

-- The patient's own MRN, for the patient-facing policies.
create or replace function public.my_mrn() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select mrn from patients where auth_user_id = auth.uid();
$$;

-- Keep the JWT claim in step with the staff table.
create or replace function public.sync_role_claim()
returns trigger language plpgsql security definer as $$
begin
  update auth.users
     set raw_app_meta_data =
         coalesce(raw_app_meta_data,'{}'::jsonb) || jsonb_build_object('role', new.role::text)
   where id = new.id;
  return new;
end $$;

create trigger trg_sync_role after insert or update of role on staff
  for each row execute function public.sync_role_claim();

-- ---------- enable RLS everywhere ----------

alter table staff            enable row level security;
alter table patients         enable row level security;
alter table appointments     enable row level security;
alter table encounters       enable row level security;
alter table vitals           enable row level security;
alter table lab_orders       enable row level security;
alter table imaging_orders   enable row level security;
alter table prescriptions    enable row level security;
alter table inventory_items  enable row level security;
alter table ward_beds        enable row level security;
alter table invoices         enable row level security;
alter table invoice_lines    enable row level security;
alter table claims           enable row level security;
alter table documents        enable row level security;
alter table audit_entries    enable row level security;
alter table notifications    enable row level security;

-- ---------- staff ----------

create policy staff_read_self_and_directory on staff for select
  using (public.is_staff());

create policy staff_admin_write on staff for all
  using (public.jwt_role() = 'admin')
  with check (public.jwt_role() = 'admin');

-- ---------- patients ----------
-- Every staff role may read the patient index. A receptionist needs to
-- find a patient to check them in; that is demographic, not clinical.
-- Clinical DETAIL is protected by the per-table policies below.

create policy patients_staff_read on patients for select
  using (public.is_staff());

create policy patients_own_read on patients for select
  using (auth_user_id = auth.uid());

create policy patients_register on patients for insert
  with check (public.jwt_role() in ('receptionist','admin'));

create policy patients_update on patients for update
  using (public.jwt_role() in ('receptionist','nurse','doctor','admin'))
  with check (public.jwt_role() in ('receptionist','nurse','doctor','admin'));

-- No delete policy anywhere on patients. Clinical records are not
-- deletable through any interface action.

-- ---------- appointments ----------

create policy appt_staff_read on appointments for select
  using (public.is_staff());

create policy appt_own_read on appointments for select
  using (mrn = public.my_mrn());

create policy appt_write on appointments for insert
  with check (public.jwt_role() in ('receptionist','doctor','admin')
              or mrn = public.my_mrn());   -- patient self-booking

create policy appt_update on appointments for update
  using (public.jwt_role() in ('receptionist','doctor','nurse','admin')
         or mrn = public.my_mrn())
  with check (true);

-- ---------- encounters — CLINICAL ----------
-- Receptionist and cashier get nothing here. This is the restriction
-- notice in the UI, now enforced below the client.

create policy enc_clinical_read on encounters for select
  using (public.is_clinical());

create policy enc_own_read on encounters for select
  using (mrn = public.my_mrn());

create policy enc_doctor_write on encounters for insert
  with check (public.jwt_role() = 'doctor');

-- ---------- vitals — CLINICAL ----------

create policy vitals_clinical_read on vitals for select
  using (public.is_clinical());

create policy vitals_own_read on vitals for select
  using (mrn = public.my_mrn());

create policy vitals_nurse_write on vitals for insert
  with check (public.jwt_role() in ('nurse','doctor'));

-- ---------- lab_orders — CLINICAL ----------

create policy lab_clinical_read on lab_orders for select
  using (public.is_clinical());

-- A patient sees ONLY verified results. An unverified result must not
-- reach them, which is the same rule as the release trigger, enforced
-- twice on purpose.
create policy lab_own_verified_read on lab_orders for select
  using (mrn = public.my_mrn() and status = 'verified');

create policy lab_doctor_order on lab_orders for insert
  with check (public.jwt_role() in ('doctor','admin'));

create policy lab_tech_advance on lab_orders for update
  using (public.jwt_role() in ('lab','admin'))
  with check (public.jwt_role() in ('lab','admin'));

-- ---------- imaging_orders — CLINICAL ----------

create policy img_clinical_read on imaging_orders for select
  using (public.is_clinical());

create policy img_own_read on imaging_orders for select
  using (mrn = public.my_mrn() and status = 'reported');

create policy img_doctor_order on imaging_orders for insert
  with check (public.jwt_role() in ('doctor','admin'));

create policy img_radiology_update on imaging_orders for update
  using (public.jwt_role() in ('radiology','admin'))
  with check (public.jwt_role() in ('radiology','admin'));

-- ---------- prescriptions — CLINICAL ----------

create policy rx_clinical_read on prescriptions for select
  using (public.is_clinical());

create policy rx_own_read on prescriptions for select
  using (mrn = public.my_mrn());

create policy rx_doctor_write on prescriptions for insert
  with check (public.jwt_role() = 'doctor');

create policy rx_pharmacist_dispense on prescriptions for update
  using (public.jwt_role() in ('pharmacist','admin'))
  with check (public.jwt_role() in ('pharmacist','admin'));

-- ---------- inventory_items ----------

create policy inv_read on inventory_items for select
  using (public.jwt_role() in ('pharmacist','doctor','nurse','admin'));

create policy inv_write on inventory_items for all
  using (public.jwt_role() in ('pharmacist','admin'))
  with check (public.jwt_role() in ('pharmacist','admin'));

-- ---------- ward_beds ----------

create policy beds_read on ward_beds for select
  using (public.is_staff());

create policy beds_write on ward_beds for update
  using (public.jwt_role() in ('nurse','doctor','admin'))
  with check (public.jwt_role() in ('nurse','doctor','admin'));

-- ---------- invoices — FINANCIAL ----------
-- Cashier and receptionist DO get these. That is the point of the split:
-- billing access without clinical access.

create policy inv_staff_read on invoices for select
  using (public.jwt_role() in ('cashier','receptionist','admin','doctor','pharmacist'));

create policy inv_own_read on invoices for select
  using (mrn = public.my_mrn());

create policy inv_cashier_payment on invoices for update
  using (public.jwt_role() in ('cashier','admin'))
  with check (public.jwt_role() in ('cashier','admin'));

create policy invline_read on invoice_lines for select
  using (
    public.jwt_role() in ('cashier','receptionist','admin','doctor','pharmacist')
    or exists (select 1 from invoices i
                where i.id = invoice_lines.invoice_id and i.mrn = public.my_mrn())
  );

-- Lines are written by the add_invoice_line function, which is
-- security definer, so no direct insert policy is granted.

-- ---------- claims — FINANCIAL ----------

create policy claims_read on claims for select
  using (public.jwt_role() in ('cashier','admin'));

create policy claims_write on claims for all
  using (public.jwt_role() in ('cashier','admin'))
  with check (public.jwt_role() in ('cashier','admin'));

-- ---------- documents ----------

create policy docs_clinical_read on documents for select
  using (public.is_clinical());

create policy docs_own_read on documents for select
  using (mrn = public.my_mrn());

create policy docs_clinical_write on documents for insert
  with check (public.is_clinical());

-- ---------- audit_entries — APPEND ONLY ----------
-- Read: admin only. Write: only through write_audit(), which is
-- security definer. NO update policy and NO delete policy exist, so
-- nobody can alter history, including an administrator.

create policy audit_admin_read on audit_entries for select
  using (public.jwt_role() = 'admin');

-- deliberately absent: audit update policy
-- deliberately absent: audit delete policy

revoke update, delete on audit_entries from authenticated, anon;

-- ---------- notifications ----------

create policy notif_own_read on notifications for select
  using (mrn = public.my_mrn() or staff_id = auth.uid());

create policy notif_own_update on notifications for update
  using (mrn = public.my_mrn() or staff_id = auth.uid())
  with check (true);

-- ================================================================
-- VERIFICATION — step 2 acceptance.
-- These correspond to test cases TC-95 to TC-99 in the submitted
-- Testing Report, but run against the DATABASE, not the interface.
-- ================================================================
--
-- For each check: sign in as that role via the Supabase client, then run
-- the query. Do NOT use the service-role key — it bypasses RLS and will
-- give you a false pass.
--
-- TC-96  Cashier cannot read clinical data
--        as cashier:  select count(*) from encounters;   -> 0
--        as cashier:  select count(*) from vitals;       -> 0
--        as cashier:  select count(*) from lab_orders;   -> 0
--        as cashier:  select count(*) from prescriptions;-> 0
--        as cashier:  select count(*) from invoices;     -> > 0   (billing IS allowed)
--
-- TC-97  Receptionist cannot read clinical data
--        as receptionist: select count(*) from encounters; -> 0
--        as receptionist: select count(*) from patients;   -> > 0 (demographics allowed)
--
-- TC-99  A patient sees only their own record
--        as patient:  select count(*) from patients;    -> 1
--        as patient:  select mrn from patients;         -> only their own MRN
--        as patient:  select count(*) from encounters
--                      where mrn <> public.my_mrn();    -> 0
--
-- Unverified results must not reach a patient
--        as lab:      insert a lab order, advance to 'resulted', stop.
--        as patient:  select count(*) from lab_orders
--                      where test_name = '<that test>'; -> 0
--        as lab:      advance it to 'verified'.
--        as patient:  same query;                       -> 1
--
-- Audit is immutable
--        as admin:    update audit_entries set action='x' where id=1;
--                     -> must FAIL (no policy, and grant revoked)
--        as admin:    delete from audit_entries where id=1;
--                     -> must FAIL
--
-- Cross-role write refusal
--        as nurse:    insert into encounters (...);      -> must FAIL
--        as cashier:  insert into prescriptions (...);   -> must FAIL
--        as doctor:   update inventory_items set quantity=0; -> must FAIL
--
-- If ANY of these gives the wrong answer, stop and fix the policy.
-- A passing UI with a failing policy is exactly the weakness this step
-- exists to remove.
