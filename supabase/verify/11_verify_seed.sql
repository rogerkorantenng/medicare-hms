-- ================================================================
-- Step 3 acceptance — the verification block at the bottom of seed.sql
-- ================================================================
-- Invoice totals are the one that matters: they come from the
-- sync_invoice_total trigger. If they are zero the trigger is not firing.

\set ON_ERROR_STOP on

do $$
declare
  failures int := 0;
  v int;
begin
  -- counts
  select count(*) into v from patients;
  if v <> 28 then raise warning 'FAIL  patients = %, expected 28', v; failures := failures + 1;
  else raise notice 'pass  patients = 28'; end if;

  select count(*) into v from staff;
  if v <> 11 then raise warning 'FAIL  staff = %, expected 11', v; failures := failures + 1;
  else raise notice 'pass  staff = 11'; end if;

  select count(*) into v from ward_beds;
  if v <> 34 then raise warning 'FAIL  ward_beds = %, expected 34', v; failures := failures + 1;
  else raise notice 'pass  ward_beds = 34'; end if;

  select count(*) into v from ward_beds where mrn is not null;
  if v <> 3 then raise warning 'FAIL  occupied beds = %, expected 3', v; failures := failures + 1;
  else raise notice 'pass  occupied beds = 3'; end if;

  select count(*) into v from inventory_items;
  if v <> 14 then raise warning 'FAIL  inventory_items = %, expected 14', v; failures := failures + 1;
  else raise notice 'pass  inventory_items = 14'; end if;

  select count(*) into v from inventory_items where quantity < reorder_level;
  if v <> 2 then raise warning 'FAIL  low stock = %, expected 2', v; failures := failures + 1;
  else raise notice 'pass  low stock items = 2'; end if;

  if failures > 0 then
    raise exception 'STEP 3 FAILED — % seed count(s) wrong', failures;
  end if;
  raise notice '--- seed counts OK ---';
end $$;

-- Invoice totals and derived status. Expected, from seed.sql:
--   INV-2088 360.00 360.00 paid
--   INV-2089 200.00   0.00 unpaid
--   INV-2090 165.00   0.00 unpaid
--   INV-2091 165.00   0.00 unpaid
\echo
\echo 'invoices — total must be non-zero, status must be derived:'
select id, total, paid, status from invoices order by id;

do $$
declare bad int;
begin
  select count(*) into bad from invoices where total = 0;
  if bad > 0 then
    raise exception 'STEP 3 FAILED — % invoice(s) have total 0; the sync_invoice_total trigger is not firing', bad;
  end if;

  select count(*) into bad from invoices i
   where i.status <> case when i.paid >= i.total and i.total > 0 then 'paid'
                          when i.paid > 0 then 'part_paid' else 'unpaid' end;
  if bad > 0 then
    raise exception 'STEP 3 FAILED — % invoice(s) have a status inconsistent with total and paid', bad;
  end if;

  raise notice '--- STEP 3 PASSED: totals synced by trigger, status derived correctly ---';
end $$;
