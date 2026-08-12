-- ================================================================
-- Step 4 acceptance — the application functions
-- ================================================================
-- The two that carry real risk are sign_encounter, which must be all or
-- nothing, and free_slots, which is the fix for defect D-03.

\set ON_ERROR_STOP on

select id as doctor_id from auth.users where email = 'doctor@medicare.com' \gset
select id as nurse_id  from auth.users where email = 'nurse@medicare.com'  \gset

\echo ''
\echo '--- free_slots excludes bookings (defect D-03) ---'
-- ST-001 already holds 2026-08-03 09:00 from the seed.
begin;
  select verify_sign_in(:'doctor_id','doctor');
  set local role authenticated;
  do $$
  declare v_doc uuid := (select id from staff where staff_no='ST-001'); n int;
  begin
    select count(*) into n from free_slots(v_doc, '2026-08-03') s where s = '09:00';
    if n <> 0 then raise exception 'FAIL free_slots offered a slot that is already booked'; end if;
    raise notice 'pass  09:00 is withheld because it is already booked';

    select count(*) into n from free_slots(v_doc, '2026-08-03');
    if n <> 9 then raise exception 'FAIL expected 9 of 10 slots free, got %', n; end if;
    raise notice 'pass  the other 9 slots are offered';
  end $$;
commit;

\echo ''
\echo '--- sign_encounter is atomic ---'
begin;
  select verify_sign_in(:'doctor_id','doctor');
  set local role authenticated;
  do $$
  declare
    v_enc bigint;
    v_labs_before int; v_rx_before int; v_lines_before int;
    v_labs_after  int; v_rx_after  int; v_lines_after  int;
  begin
    select count(*) into v_labs_before  from lab_orders    where mrn='PT-20524';
    select count(*) into v_rx_before    from prescriptions where mrn='PT-20524';
    select count(*) into v_lines_before from invoice_lines l
      join invoices i on i.id = l.invoice_id where i.mrn='PT-20524';

    v_enc := sign_encounter(jsonb_build_object(
      'mrn','PT-20524',
      'complaint','Chest tightness on exertion',
      'diagnosis','I20.9 Angina pectoris, unspecified',
      'notes','Reviewed. Start antianginal, arrange treadmill test.',
      'aiAssisted', true,
      'labs',  jsonb_build_array(jsonb_build_object('testName','Troponin I','priority','stat','price',80)),
      'imaging', jsonb_build_array(jsonb_build_object('modality','X-Ray','bodyRegion','Chest','priority','routine','price',120)),
      'prescriptions', jsonb_build_array(jsonb_build_object(
        'drug','Atorvastatin 20mg','dose','1 tablet','frequency','At night','duration','30 days','quantity',30)),
      'followUpDays', 14,
      'consultationFee', 120
    ));

    select count(*) into v_labs_after  from lab_orders    where mrn='PT-20524';
    select count(*) into v_rx_after    from prescriptions where mrn='PT-20524';
    select count(*) into v_lines_after from invoice_lines l
      join invoices i on i.id = l.invoice_id where i.mrn='PT-20524';

    if v_labs_after  <> v_labs_before  + 1 then raise exception 'FAIL lab order not staged'; end if;
    if v_rx_after    <> v_rx_before    + 1 then raise exception 'FAIL prescription not staged'; end if;
    if v_lines_after <> v_lines_before + 1 then raise exception 'FAIL consultation fee not captured'; end if;
    if not exists (select 1 from imaging_orders where mrn='PT-20524' and encounter_id = v_enc)
      then raise exception 'FAIL imaging not staged'; end if;
    if not exists (select 1 from appointments where mrn='PT-20524' and appt_type='Follow-up')
      then raise exception 'FAIL follow-up not booked'; end if;

    raise notice 'pass  encounter %, with lab, imaging, prescription, fee and follow-up', v_enc;
  end $$;
commit;

-- The audit entry has to be checked as an administrator. A doctor cannot
-- read audit_entries at all, so asserting it from the doctor's session
-- would report a written row as missing.
select id as admin_id from auth.users where email = 'admin@medicare.com' \gset
begin;
  select verify_sign_in(:'admin_id','admin');
  set local role authenticated;
  do $$
  begin
    if not exists (select 1 from audit_entries
                    where action = 'Signed consultation' and target = 'Daniel Osei')
      then raise exception 'FAIL audit entry not written'; end if;
    raise notice 'pass  audit entry written and visible to an administrator';
  end $$;
commit;

\echo ''
\echo '--- sign_encounter rolls everything back when the diagnosis is missing ---'
begin;
  select verify_sign_in(:'doctor_id','doctor');
  set local role authenticated;
  do $$
  declare v_labs_before int; v_labs_after int;
  begin
    select count(*) into v_labs_before from lab_orders where mrn='PT-20551';
    begin
      perform sign_encounter(jsonb_build_object(
        'mrn','PT-20551', 'complaint','Headache', 'diagnosis','   ',
        'labs', jsonb_build_array(jsonb_build_object('testName','CBC','priority','routine','price',35))
      ));
      raise exception 'FAIL an empty diagnosis was accepted';
    exception when others then
      if sqlerrm like 'FAIL%' then raise; end if;
      raise notice 'pass  refused: %', sqlerrm;
    end;
    select count(*) into v_labs_after from lab_orders where mrn='PT-20551';
    if v_labs_after <> v_labs_before then
      raise exception 'FAIL the staged lab order survived a failed signing — not atomic';
    end if;
    raise notice 'pass  nothing was left behind';
  end $$;
commit;

\echo ''
\echo '--- a nurse cannot sign a consultation through the function either ---'
begin;
  select verify_sign_in(:'nurse_id','nurse');
  set local role authenticated;
  do $$
  begin
    begin
      perform sign_encounter(jsonb_build_object(
        'mrn','PT-20551','complaint','Cough','diagnosis','J06.9 URTI'));
      raise exception 'FAIL a nurse signed a consultation through sign_encounter';
    exception when others then
      if sqlerrm like 'FAIL%' then raise; end if;
      raise notice 'pass  refused: %', sqlerrm;
    end;
  end $$;
commit;

\echo ''
\echo '--- discharge frees the bed and writes the summary in one go ---'
begin;
  select verify_sign_in(:'nurse_id','nurse');
  set local role authenticated;
  do $$
  declare v_docs_before int; v_docs_after int; v_occupied text;
  begin
    select count(*) into v_docs_before from documents where mrn='PT-20492';
    perform discharge_patient('General Ward A','A1');
    select mrn into v_occupied from ward_beds where ward='General Ward A' and bed_no='A1';
    select count(*) into v_docs_after from documents where mrn='PT-20492';

    if v_occupied is not null then raise exception 'FAIL the bed was not freed'; end if;
    if v_docs_after <> v_docs_before + 1 then raise exception 'FAIL no discharge summary written'; end if;
    raise notice 'pass  bed freed and discharge summary written';
  end $$;
commit;

\echo ''
\echo '--- payment names the provider in the audit trail ---'
select id as cashier_id from auth.users where email = 'cashier@medicare.com' \gset
begin;
  select verify_sign_in(:'cashier_id','cashier');
  set local role authenticated;
  do $$
  declare v_paid numeric;
  begin
    perform record_payment('INV-2089', 50.00, 'momo', 'MTN MoMo');
    select paid into v_paid from invoices where id='INV-2089';
    if v_paid <> 50.00 then raise exception 'FAIL payment not applied, paid = %', v_paid; end if;
    raise notice 'pass  payment applied to INV-2089';
  end $$;
commit;

-- Again as an administrator: a cashier cannot read audit_entries, so
-- checking the wording from the cashier's session would compare against
-- NULL and pass without testing anything.
begin;
  select verify_sign_in(:'admin_id','admin');
  set local role authenticated;
  do $$
  declare v_action text;
  begin
    select action into v_action from audit_entries
     where action like 'Payment recorded%INV-2089' order by occurred_at desc limit 1;
    if v_action is null then
      raise exception 'FAIL no audit entry was written for the payment';
    end if;
    if v_action <> 'Payment recorded (MoMo · MTN MoMo) INV-2089' then
      raise exception 'FAIL audit line reads "%", which does not name the provider', v_action;
    end if;
    raise notice 'pass  audit reads: %', v_action;
  end $$;
commit;

do $$
declare v text;
begin
  select status into v from invoices where id='INV-2089';
  if v <> 'part_paid' then raise exception 'FAIL derived status is % after a partial payment', v; end if;
  raise notice 'pass  derived status is part_paid';
  raise notice '--- STEP 4 PASSED: application functions behave as contracted ---';
end $$;
