-- ================================================================
-- Step 1 acceptance — the nine checks at the bottom of schema.sql
-- ================================================================
-- Each of these MUST fail. The handoff is explicit: "If any of these
-- SUCCEEDS, the schema is wrong. Fix it before step 2."
--
-- Everything runs inside one transaction that is rolled back, so the
-- seeded data is untouched.

\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.expect_failure(p_label text, p_stmt text)
returns boolean language plpgsql as $$
begin
  execute p_stmt;
  raise warning 'FAIL  % — statement succeeded but should have been rejected', p_label;
  return false;
exception when others then
  raise notice 'pass  % — rejected: %', p_label, replace(sqlerrm, E'\n', ' ');
  return true;
end $$;

do $$
declare
  ok boolean;
  failures int := 0;
  v_doctor uuid := (select id from staff where staff_no='ST-001');
  v_lab    uuid := (select id from staff where staff_no='ST-004');
  v_pharm  uuid := (select id from staff where staff_no='ST-006');
  v_rx     bigint;
  v_order  bigint;
begin
  -- 1. Encounter with no diagnosis
  ok := pg_temp.expect_failure('1 encounter with empty diagnosis', format(
    $q$insert into encounters (mrn, doctor_id, complaint, diagnosis)
       values ('PT-20481', %L, 'Headache', '')$q$, v_doctor));
  if not ok then failures := failures + 1; end if;

  -- 2. Double booking: same doctor, same date, same time, both live
  insert into appointments (mrn, doctor_id, specialty, appt_date, appt_time, status)
  values ('PT-20481', v_doctor, 'Cardiology', '2026-09-01', '09:00', 'confirmed');
  ok := pg_temp.expect_failure('2 double booking', format(
    $q$insert into appointments (mrn, doctor_id, specialty, appt_date, appt_time, status)
       values ('PT-20492', %L, 'Cardiology', '2026-09-01', '09:00', 'confirmed')$q$, v_doctor));
  if not ok then failures := failures + 1; end if;

  -- 3. One patient in two beds at once
  update ward_beds set mrn = 'PT-20524', admitted_at = now()
   where ward = 'General Ward A' and bed_no = 'A2';
  ok := pg_temp.expect_failure('3 one patient in two beds',
    $q$update ward_beds set mrn = 'PT-20524', admitted_at = now()
        where ward = 'General Ward A' and bed_no = 'A3'$q$);
  if not ok then failures := failures + 1; end if;

  -- 4. Skipping a lab stage: ordered straight to verified
  ok := pg_temp.expect_failure('4 lab stage skip (ordered -> verified)',
    $q$update lab_orders set status = 'verified'
        where test_name = 'Troponin I' and status = 'ordered'$q$);
  if not ok then failures := failures + 1; end if;

  -- 5. Verifying with no result value recorded
  select id into v_order from lab_orders where test_name = 'Troponin I' and status = 'ordered';
  update lab_orders set status = 'collected'  where id = v_order;
  update lab_orders set status = 'processing' where id = v_order;
  update lab_orders set status = 'resulted'   where id = v_order;   -- result_value still null
  ok := pg_temp.expect_failure('5 verify with no result value', format(
    $q$update lab_orders set status = 'verified' where id = %s$q$, v_order));
  if not ok then failures := failures + 1; end if;

  -- 6. Over-dispensing: quantity greater than stock on hand
  --    Ceftriaxone 1g inj is seeded at 18 units.
  insert into prescriptions (mrn, prescriber_id, drug, dose, frequency, duration, quantity)
  values ('PT-20524', v_doctor, 'Ceftriaxone 1g inj', '1 vial', 'Once daily', '5 days', 999)
  returning id into v_rx;
  ok := pg_temp.expect_failure('6 over-dispense beyond stock', format(
    $q$select dispense_prescription(%s, %L)$q$, v_rx, v_pharm));
  if not ok then failures := failures + 1; end if;

  -- 7. Claim moving backwards
  ok := pg_temp.expect_failure('7 claim moving backwards (paid -> submitted)',
    $q$update claims set status = 'submitted' where id = 'CLM-499'$q$);
  if not ok then failures := failures + 1; end if;

  -- 8. Implausible vitals
  ok := pg_temp.expect_failure('8 implausible vitals (pulse 400)', format(
    $q$insert into vitals (mrn, recorded_by, pulse) values ('PT-20481', %L, 400)$q$, v_doctor));
  if not ok then failures := failures + 1; end if;

  -- 9. Invoice status is generated, not writable
  ok := pg_temp.expect_failure('9 writing the generated invoice status',
    $q$update invoices set status = 'paid' where id = 'INV-2089'$q$);
  if not ok then failures := failures + 1; end if;

  if failures > 0 then
    raise exception 'STEP 1 FAILED — % of 9 constraints did not reject', failures;
  end if;
  raise notice '--- STEP 1 PASSED: all 9 constraints rejected as specified ---';
end $$;

rollback;
