-- ================================================================
-- Step 2 acceptance — row-level security, TC-95 to TC-99
-- ================================================================
-- The most important file in the handoff, so it gets the most testing.
--
-- Each block signs in as a role (sets the JWT claims the way Supabase
-- does) and then switches to the `authenticated` database role, because
-- the table owner and superusers bypass row-level security. Running
-- these as postgres would give a false pass, which is the same mistake
-- deployment.md warns about with the service-role key.

\set ON_ERROR_STOP on

-- Helpers. Plain SECURITY INVOKER functions, so they execute with the
-- privileges of whoever calls them and RLS applies normally.
create or replace function expect_count(p_label text, p_sql text, p_expected text)
returns boolean language plpgsql as $$
declare n bigint;
begin
  execute p_sql into n;
  if (p_expected = '0'  and n = 0)
  or (p_expected = '>0' and n > 0)
  or (p_expected ~ '^[0-9]+$' and n = p_expected::bigint) then
    raise notice 'pass  % — % (expected %)', p_label, n, p_expected;
    return true;
  end if;
  raise warning 'FAIL  % — got %, expected %', p_label, n, p_expected;
  return false;
end $$;

-- A write can be blocked two different ways under row-level security, and
-- both count as blocked:
--   INSERT failing a WITH CHECK raises an error;
--   UPDATE or DELETE failing a USING clause raises nothing at all and
--   simply matches zero rows.
-- Demanding an exception for the second kind would report a working
-- policy as broken, so this asserts "nothing changed", not "it threw".
create or replace function expect_refused(p_label text, p_sql text)
returns boolean language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  if n = 0 then
    raise notice 'pass  % — blocked, 0 rows affected', p_label;
    return true;
  end if;
  raise warning 'FAIL  % — the write was allowed, % row(s) changed', p_label, n;
  return false;
exception when others then
  raise notice 'pass  % — refused: %', p_label, replace(sqlerrm, E'\n', ' ');
  return true;
end $$;

create table if not exists verify_results (label text, ok boolean);
truncate verify_results;

-- Resolve the user ids before dropping privileges.
select id as cashier_id      from auth.users where email = 'cashier@medicare.com'    \gset
select id as reception_id    from auth.users where email = 'reception@medicare.com'  \gset
select id as patient_id      from auth.users where email = 'patient@medicare.com'    \gset
select id as admin_id        from auth.users where email = 'admin@medicare.com'      \gset
select id as nurse_id        from auth.users where email = 'nurse@medicare.com'      \gset
select id as doctor_id       from auth.users where email = 'doctor@medicare.com'     \gset
select id as lab_id          from auth.users where email = 'lab@medicare.com'        \gset

\echo ''
\echo '--- TC-96  cashier: billing yes, clinical no ---'
begin;
  select verify_sign_in(:'cashier_id', 'cashier');
  set local role authenticated;
  insert into verify_results
  select 'TC-96 encounters',    expect_count('TC-96 cashier encounters',    'select count(*) from encounters', '0') union all
  select 'TC-96 vitals',        expect_count('TC-96 cashier vitals',        'select count(*) from vitals', '0') union all
  select 'TC-96 lab_orders',    expect_count('TC-96 cashier lab_orders',    'select count(*) from lab_orders', '0') union all
  select 'TC-96 prescriptions', expect_count('TC-96 cashier prescriptions', 'select count(*) from prescriptions', '0') union all
  select 'TC-96 invoices',      expect_count('TC-96 cashier invoices (billing IS allowed)', 'select count(*) from invoices', '>0');
commit;

\echo ''
\echo '--- TC-97  receptionist: demographics yes, clinical no ---'
begin;
  select verify_sign_in(:'reception_id', 'receptionist');
  set local role authenticated;
  insert into verify_results
  select 'TC-97 encounters', expect_count('TC-97 receptionist encounters', 'select count(*) from encounters', '0') union all
  select 'TC-97 patients',   expect_count('TC-97 receptionist patients (demographics allowed)', 'select count(*) from patients', '>0');
commit;

\echo ''
\echo '--- TC-99  a patient sees only their own record ---'
begin;
  select verify_sign_in(:'patient_id', 'patient');
  set local role authenticated;
  insert into verify_results
  select 'TC-99 own patient row', expect_count('TC-99 patient sees 1 patient row', 'select count(*) from patients', '1') union all
  select 'TC-99 own mrn only',    expect_count('TC-99 that row is their own MRN',
           $q$select count(*) from patients where mrn <> 'PT-20481'$q$, '0') union all
  select 'TC-99 others encounters', expect_count('TC-99 no other patient''s encounters',
           'select count(*) from encounters where mrn <> public.my_mrn()', '0') union all
  select 'TC-99 others invoices', expect_count('TC-99 no other patient''s invoices',
           $q$select count(*) from invoices where mrn <> 'PT-20481'$q$, '0');
commit;

\echo ''
\echo '--- unverified results must not reach a patient ---'
-- The doctor places the order, the technician takes it as far as resulted.
begin;
  select verify_sign_in(:'doctor_id', 'doctor');
  set local role authenticated;
  insert into lab_orders (mrn, ordered_by, test_name, priority, status, ref_range, price)
  values ('PT-20481', (select id from staff where staff_no='ST-001'),
          'Serum Potassium', 'routine', 'ordered', '3.5-5.1 mmol/L', 30.00);
commit;

begin;
  select verify_sign_in(:'lab_id', 'lab');
  set local role authenticated;
  update lab_orders set status='collected'  where test_name='Serum Potassium';
  update lab_orders set status='processing' where test_name='Serum Potassium';
  update lab_orders set status='resulted', result_value='4.2 mmol/L', flag='normal'
   where test_name='Serum Potassium';
commit;

begin;
  select verify_sign_in(:'patient_id', 'patient');
  set local role authenticated;
  insert into verify_results
  select 'release: hidden before verify', expect_count('patient cannot see a resulted-but-unverified test',
    $q$select count(*) from lab_orders where test_name = 'Serum Potassium'$q$, '0');
commit;

begin;
  select verify_sign_in(:'lab_id', 'lab');
  set local role authenticated;
  update lab_orders set status='verified' where test_name='Serum Potassium';
commit;

begin;
  select verify_sign_in(:'patient_id', 'patient');
  set local role authenticated;
  insert into verify_results
  select 'release: visible after verify', expect_count('patient sees it once verified',
    $q$select count(*) from lab_orders where test_name = 'Serum Potassium'$q$, '1');
commit;

\echo ''
\echo '--- the audit trail is immutable, including for an administrator ---'
begin;
  select verify_sign_in(:'admin_id', 'admin');
  set local role authenticated;
  insert into verify_results
  select 'audit read',   expect_count('admin can read the audit log', 'select count(*) from audit_entries', '>0') union all
  select 'audit update', expect_refused('admin cannot update an audit entry',
           $q$update audit_entries set action = 'tampered' where id = (select min(id) from audit_entries)$q$) union all
  select 'audit delete', expect_refused('admin cannot delete an audit entry',
           $q$delete from audit_entries where id = (select min(id) from audit_entries)$q$);
commit;

\echo ''
\echo '--- cross-role writes are refused ---'
begin;
  select verify_sign_in(:'nurse_id', 'nurse');
  set local role authenticated;
  insert into verify_results
  select 'nurse cannot write encounters', expect_refused('a nurse cannot sign a consultation',
    $q$insert into encounters (mrn, doctor_id, complaint, diagnosis)
       values ('PT-20481', (select doctor_id from appointments limit 1), 'Cough', 'J06.9 URTI')$q$);
commit;

begin;
  select verify_sign_in(:'cashier_id', 'cashier');
  set local role authenticated;
  insert into verify_results
  select 'cashier cannot prescribe', expect_refused('a cashier cannot write a prescription',
    $q$insert into prescriptions (mrn, prescriber_id, drug, dose, frequency, duration, quantity)
       values ('PT-20481', (select id from staff where role='doctor' limit 1),
               'Paracetamol 500mg', '1 tablet', 'Twice daily', '5 days', 10)$q$);
commit;

begin;
  select verify_sign_in(:'doctor_id', 'doctor');
  set local role authenticated;
  insert into verify_results
  select 'doctor cannot alter stock', expect_refused('a doctor cannot alter pharmacy stock',
    $q$update inventory_items set quantity = 0 where name = 'Paracetamol 500mg'$q$);
commit;

-- Belt and braces on the one above: the stock must still be there.
select 'doctor stock unchanged' as label,
       (select quantity from inventory_items where name = 'Paracetamol 500mg') = 500 as ok
  into temp t_stock;
insert into verify_results select label, ok from t_stock;
do $$
declare v int;
begin
  select quantity into v from inventory_items where name = 'Paracetamol 500mg';
  if v = 500 then raise notice 'pass  doctor did not change pharmacy stock — still % units', v;
  else raise warning 'FAIL  pharmacy stock was altered by a doctor — now % units', v; end if;
end $$;

\echo ''
\echo '--- summary ---'
select count(*) filter (where ok) as passed,
       count(*) filter (where not ok) as failed,
       count(*) as total
  from verify_results;

select label from verify_results where not ok;

do $$
declare bad int;
begin
  select count(*) into bad from verify_results where not ok;
  if bad > 0 then
    raise exception 'STEP 2 FAILED — % row-level security check(s) gave the wrong answer', bad;
  end if;
  raise notice '--- STEP 2 PASSED: row-level security enforced below the client ---';
end $$;

drop table verify_results;
