-- ============================================================
-- MediCare+ HMS — PASTE 2 of 2: seed data and functions
-- ============================================================
-- Run this ONLY after scripts/create-users.mjs has reported
-- all 12 auth users in place. It will fail on the staff foreign
-- key otherwise, which is the correct behaviour.
-- ============================================================

-- ================================================================
-- MediCare+ HMS — Seed data
-- Run AFTER schema.sql and rls-policies.sql
-- ================================================================
-- Produces the dataset the examiner sees on first visit: nine role
-- accounts, 28 synthetic patients, six wards, laboratory catalogue,
-- inventory, and open work in every department so no screen is empty.
--
-- ALL DATA IS SYNTHETIC. No real patient data appears anywhere.

-- ---------- 1. staff accounts ----------
-- Create the nine auth users FIRST via the Supabase dashboard or the
-- Admin API, then run this to attach their staff rows.
--
--   node scripts/create-users.mjs     (see deployment.md)
--
-- Emails, matching the login screen in the design:
--   patient@medicare.com      doctor@medicare.com     nurse@medicare.com
--   reception@medicare.com    lab@medicare.com        radiology@medicare.com
--   pharmacy@medicare.com     cashier@medicare.com    admin@medicare.com

insert into staff (id, staff_no, full_name, role, department, on_duty) values
  ((select id from auth.users where email='doctor@medicare.com'),    'ST-001','Dr. Michael Chen',   'doctor',       'Cardiology',   true),
  ((select id from auth.users where email='nurse@medicare.com'),     'ST-002','Grace Adjei',        'nurse',        'Outpatient',   true),
  ((select id from auth.users where email='reception@medicare.com'), 'ST-003','Akosua Darko',       'receptionist', 'Front Desk',   true),
  ((select id from auth.users where email='lab@medicare.com'),       'ST-004','Kwesi Antwi',        'lab',          'Laboratory',   true),
  ((select id from auth.users where email='radiology@medicare.com'), 'ST-005','Dr. Omar Haddad',    'radiology',    'Radiology',    true),
  ((select id from auth.users where email='pharmacy@medicare.com'),  'ST-006','Yaa Frimpong',       'pharmacist',   'Pharmacy',     true),
  ((select id from auth.users where email='cashier@medicare.com'),   'ST-007','Kofi Owusu',         'cashier',      'Accounts',     true),
  ((select id from auth.users where email='admin@medicare.com'),     'ST-008','Nana Ampofo',        'admin',        'Administration', true);

-- Additional doctors so the booking screen has a real roster.
-- These have no login; they exist as schedulable staff.
--
-- DEVIATION FROM THE HANDOFF, flagged rather than made silently.
-- The handoff shipped these three rows with gen_random_uuid() as the id.
-- That cannot load, because schema.sql declares
--     staff.id uuid primary key references auth.users(id)
-- so every staff row must correspond to an auth user. The two files
-- contradicted each other and the seed failed on this statement with
-- "violates foreign key constraint staff_id_fkey".
--
-- Resolved in favour of the schema, because the schema is what the
-- submitted entity relationship diagram describes and changing it would
-- put the code out of step with six submitted documents. The three roster
-- doctors now get auth users created WITHOUT a password by
-- scripts/create-users.mjs, so they remain schedulable staff that nobody
-- can sign in as — which is exactly what the original comment intended.
insert into staff (id, staff_no, full_name, role, department, on_duty) values
  ((select id from auth.users where email='emily.parker@medicare.com'),  'ST-009','Dr. Emily Parker',   'doctor','Neurology',    true),
  ((select id from auth.users where email='lisa.thompson@medicare.com'), 'ST-010','Dr. Lisa Thompson',  'doctor','Dermatology',  true),
  ((select id from auth.users where email='james.wilson@medicare.com'),  'ST-011','Dr. James Wilson',   'doctor','Orthopaedics', false);

-- ---------- 2. patients ----------
-- Patient 1 is the mobile app account and is linked to an auth user.

insert into patients (mrn, auth_user_id, full_name, age, sex, phone, blood_group, allergies, conditions, insurance, last_visit) values
  ('PT-20481', (select id from auth.users where email='patient@medicare.com'),
   'Sarah Johnson', 34, 'F', '+233 (24) 234-5678', 'O+', '{Penicillin,Pollen}', '{Hypertension}', 'BlueShield HMO', '2026-07-28');

insert into patients (mrn, full_name, age, sex, phone, blood_group, allergies, conditions, insurance, last_visit) values
  ('PT-20492','Kwame Mensah',       58,'M','+233 (24) 311-9042','B+', '{}',                '{"Type 2 Diabetes",Hypertension}','Medicare',    '2026-07-30'),
  ('PT-20518','Fatima Al-Hassan',   27,'F','+233 (20) 552-1180','A+', '{Sulfa}',           '{Asthma}',                        'Aetna PPO',   '2026-07-29'),
  ('PT-20524','Daniel Osei',        41,'M','+233 (27) 884-2201','O-', '{}',                '{}',                              'NHIS',        '2026-07-27'),
  ('PT-20536','Comfort Baidoo',     63,'F','+233 (24) 190-7733','AB+','{Penicillin}',      '{Hypertension,Hyperlipidaemia}',  'Medicare',    '2026-07-31'),
  ('PT-20551','James Brown',        45,'M','+233 (26) 219-4451','A-', '{}',                '{Migraine}',                      'Self-pay',    '2026-07-25');

-- 22 further patients so search, filtering and pagination feel necessary.
do $$
declare
  names text[] := array['Olivia Mensah','Liam Anderson','Ava Osei','Noah Walker',
    'Isabella Reed','Ethan Boateng','Mia Turner','Lucas Hayes','Amelia Foster',
    'Henry Coleman','Charlotte Simmons','Jack Murphy','Harper Bell',
    'Owen Richardson','Ella Watson','Leo Barnes','Grace Howard','Daniel Asante',
    'Chloe Griffin','Samuel Price','Zoe Jenkins','Adam Perry'];
  -- DEVIATION FROM THE HANDOFF, flagged rather than made silently.
  -- The handoff declared this as a multidimensional text[][] mixing
  -- empty arrays with one-element arrays. Postgres rejects that with
  -- "multidimensional arrays must have array expressions with matching
  -- dimensions", so seed.sql could not load at all. Held as a flat list
  -- of eight condition slots instead, empty string meaning no condition,
  -- and expanded at the point of use. The data produced is identical to
  -- what the handoff intended.
  conds text[] := array['', 'Hypertension', 'Asthma', 'Type 2 Diabetes',
                        '', 'Migraine', 'Hyperlipidaemia', ''];
  ins text[] := array['NHIS','BlueShield HMO','Medicare','Aetna PPO','Self-pay'];
  bg text[] := array['O+','A+','B+','AB+','O-'];
  i int;
begin
  for i in 1..array_length(names,1) loop
    insert into patients (mrn, full_name, age, sex, phone, blood_group,
                          allergies, conditions, insurance, last_visit)
    values (
      'PT-2' || (700 + i)::text,
      names[i],
      22 + (i * 7) % 55,
      case when i % 2 = 0 then 'M' else 'F' end,
      '+233 (24) ' || (200 + i * 13)::text || '-' || (1000 + i * 97)::text,
      bg[1 + (i % 5)],
      case when i % 6 = 0 then array['Penicillin'] else array[]::text[] end,
      case when conds[1 + (i % 8)] = '' then array[]::text[]
           else array[conds[1 + (i % 8)]] end,
      ins[1 + (i % 5)],
      ('2026-0' || (5 + i % 3)::text || '-' || lpad((2 + i % 26)::text, 2, '0'))::date
    );
  end loop;
end $$;

-- ---------- 3. wards and beds ----------

insert into ward_beds (ward, bed_no, mrn, admitted_at) values
  ('General Ward A','A1','PT-20492', now() - interval '2 days'),
  ('General Ward A','A2', null, null),
  ('General Ward A','A3', null, null),
  ('General Ward A','A4','PT-20551', now() - interval '1 day'),
  ('General Ward A','A5', null, null),
  ('General Ward A','A6', null, null),
  ('General Ward B','B1', null, null),
  ('General Ward B','B2', null, null),
  ('General Ward B','B3','PT-20536', now() - interval '6 hours'),
  ('General Ward B','B4', null, null),
  ('General Ward B','B5', null, null),
  ('General Ward B','B6', null, null),
  ('Maternity','M1', null, null), ('Maternity','M2', null, null),
  ('Maternity','M3', null, null), ('Maternity','M4', null, null),
  ('Paediatrics','P1', null, null), ('Paediatrics','P2', null, null),
  ('Paediatrics','P3', null, null), ('Paediatrics','P4', null, null),
  ('Paediatrics','P5', null, null), ('Paediatrics','P6', null, null),
  ('Intensive Care','ICU1', null, null), ('Intensive Care','ICU2', null, null),
  ('Intensive Care','ICU3', null, null), ('Intensive Care','ICU4', null, null),
  ('Private Wing','PV1', null, null), ('Private Wing','PV2', null, null),
  ('Private Wing','PV3', null, null), ('Private Wing','PV4', null, null),
  ('Private Wing','PV5', null, null), ('Private Wing','PV6', null, null),
  ('Private Wing','PV7', null, null), ('Private Wing','PV8', null, null);

-- ---------- 4. inventory ----------
-- Two items deliberately below reorder level and one near expiry so the
-- pharmacy warnings have something to show.

insert into inventory_items (name, category, quantity, reorder_level, unit_price, expiry_date) values
  ('Lisinopril 10mg',        'Cardiovascular',  240,  50,  1.20, '2027-06-30'),
  ('Metformin 500mg',        'Endocrine',       180,  60,  0.85, '2027-03-31'),
  ('Amoxicillin 500mg',      'Antibiotic',       32,  40,  1.60, '2026-11-30'),
  ('Paracetamol 500mg',      'Analgesic',       500, 100,  0.30, '2028-01-31'),
  ('Ibuprofen 400mg',        'Analgesic',       210,  60,  0.55, '2027-09-30'),
  ('Salbutamol inhaler',     'Respiratory',      45,  20, 18.00, '2027-05-31'),
  ('Atorvastatin 20mg',      'Cardiovascular',  160,  50,  2.10, '2027-08-31'),
  ('Warfarin 5mg',           'Anticoagulant',    90,  30,  1.75, '2027-02-28'),
  ('Insulin glargine',       'Endocrine',        24,  15, 62.00, '2026-10-15'),
  ('Ceftriaxone 1g inj',     'Antibiotic',       18,  25, 24.50, '2027-04-30'),
  ('Artemether-Lumefantrine','Antimalarial',    140,  50,  8.40, '2027-07-31'),
  ('ORS sachets',            'Rehydration',     300,  80,  1.10, '2028-03-31'),
  ('Vitamin D3 1000IU',      'Supplement',      260,  60,  0.40, '2028-06-30'),
  ('Losartan 50mg',          'Cardiovascular',  120,  40,  1.90, '2027-10-31');

-- ---------- 5. open clinical work ----------

-- Appointments today and ahead
insert into appointments (mrn, doctor_id, specialty, appt_date, appt_time, appt_type, status) values
  ('PT-20481',(select id from staff where staff_no='ST-001'),'Cardiology','2026-08-03','09:00','Follow-up','confirmed'),
  ('PT-20518',(select id from staff where staff_no='ST-009'),'Neurology', '2026-08-03','10:30','Consultation','confirmed'),
  ('PT-20524',(select id from staff where staff_no='ST-001'),'Cardiology','2026-08-04','14:00','Consultation','confirmed'),
  ('PT-20536',(select id from staff where staff_no='ST-010'),'Dermatology','2026-08-05','11:00','Review','confirmed');

-- Laboratory: one STAT order that will come back critical, so the
-- escalation path has something to demonstrate.
insert into lab_orders (mrn, ordered_by, test_name, priority, status, ref_range, price) values
  ('PT-20536',(select id from staff where staff_no='ST-001'),'Troponin I','stat','ordered','< 0.04 ng/mL', 80.00),
  ('PT-20492',(select id from staff where staff_no='ST-001'),'Lipid Panel','routine','collected','LDL < 100 mg/dL', 45.00),
  ('PT-20518',(select id from staff where staff_no='ST-009'),'Complete Blood Count','routine','processing','WBC 4.0-11.0 x10^9/L', 35.00);

-- A verified result already released, so the chart and the patient app
-- have content on first visit.
insert into lab_orders (mrn, ordered_by, test_name, priority, status, result_value, ref_range, flag, verified_by, verified_at, price)
values ('PT-20481',(select id from staff where staff_no='ST-001'),'Lipid Panel','routine','verified',
        'LDL 128 mg/dL','LDL < 100 mg/dL','high',
        (select id from staff where staff_no='ST-004'), now() - interval '1 day', 45.00);

insert into imaging_orders (mrn, ordered_by, modality, body_region, priority, status, price) values
  ('PT-20492',(select id from staff where staff_no='ST-001'),'X-Ray','Chest','routine','ordered', 120.00),
  ('PT-20551',(select id from staff where staff_no='ST-009'),'CT','Head','stat','scheduled', 450.00);

insert into prescriptions (mrn, prescriber_id, drug, dose, frequency, duration, quantity, status) values
  ('PT-20481',(select id from staff where staff_no='ST-001'),'Lisinopril 10mg','1 tablet','Once daily','30 days',30,'pending'),
  ('PT-20492',(select id from staff where staff_no='ST-001'),'Metformin 500mg','1 tablet','Twice daily','30 days',60,'pending'),
  ('PT-20536',(select id from staff where staff_no='ST-001'),'Atorvastatin 20mg','1 tablet','At night','30 days',30,'pending');

insert into documents (mrn, title, kind, doc_date) values
  ('PT-20492','Referral Letter — Endocrinology','Referral','2026-07-28'),
  ('PT-20536','ECG Report R-311','Imaging report','2026-07-30'),
  ('PT-20481','Consent — Cardiac stress test','Consent form','2026-07-28');

-- ---------- 6. billing and claims ----------

insert into invoices (id, mrn, paid) values
  ('INV-2088','PT-20518', 360.00),
  ('INV-2089','PT-20536', 0),
  ('INV-2090','PT-20492', 0),
  ('INV-2091','PT-20481', 0);

insert into invoice_lines (invoice_id, description, amount) values
  ('INV-2088','Specialist consultation', 120.00),
  ('INV-2088','Complete Blood Count',     35.00),
  ('INV-2088','CT Head',                 205.00),
  ('INV-2089','Specialist consultation', 120.00),
  ('INV-2089','Troponin I',               80.00),
  ('INV-2090','Specialist consultation', 120.00),
  ('INV-2090','Lipid Panel',              45.00),
  ('INV-2091','Cardiology consultation', 120.00),
  ('INV-2091','Lipid Panel',              45.00);

insert into claims (id, invoice_id, insurer, amount, status) values
  ('CLM-499','INV-2088','Aetna PPO', 360.00,'paid'),
  ('CLM-500','INV-2089','Medicare',  200.00,'authorised'),
  ('CLM-501','INV-2090','Medicare',  165.00,'submitted');

-- ---------- 7. seed audit trail ----------

insert into audit_entries (actor_name, action, target, occurred_at) values
  ('Akosua Darko','Registered patient','Sarah Johnson',       now() - interval '5 days'),
  ('Grace Adjei','Recorded vitals','Kwame Mensah',            now() - interval '2 days'),
  ('Dr. Michael Chen','Signed consultation','Sarah Johnson',  now() - interval '1 day'),
  ('Kwesi Antwi','Verified result','Lipid Panel',             now() - interval '1 day'),
  ('Kofi Owusu','Payment recorded (cash) INV-2088','Fatima Al-Hassan', now() - interval '4 hours');

-- ================================================================
-- VERIFICATION
-- ================================================================
-- select count(*) from patients;         -> 28
-- select count(*) from staff;            -> 11
-- select count(*) from ward_beds;        -> 34
-- select count(*) from ward_beds where mrn is not null;  -> 3
-- select count(*) from inventory_items;  -> 14
-- select count(*) from inventory_items where quantity < reorder_level;  -> 2
-- select id, total, paid, status from invoices order by id;
--   INV-2088 360.00 360.00 paid
--   INV-2089 200.00   0.00 unpaid
--   INV-2090 165.00   0.00 unpaid
--   INV-2091 165.00   0.00 unpaid
--   (totals come from the trigger; if they are 0 the trigger is not firing)


-- ================================================================
-- MediCare+ HMS — application functions
-- Migration step 4. Run AFTER 0003_seed.sql.
-- ================================================================
-- These are the operations the repository contract requires to be atomic
-- or to be computed in the database rather than the client. No new tables:
-- the 16-entity model from the submitted entity relationship diagram is
-- unchanged.
--
-- All of these are SECURITY INVOKER on purpose. Row-level security then
-- does the authorising, so a nurse calling sign_encounter is refused by
-- the same policy that refuses a direct insert. Only the three helpers
-- the handoff already made SECURITY DEFINER — write_audit,
-- add_invoice_line and release_verified_result — bypass it, and each one
-- writes a row nobody is granted a direct insert policy for.

-- ---------- free slots ----------
-- Defect D-03 was caused by reading the roster and ignoring bookings
-- already made. This queries both, exactly as the contract specifies.

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

  perform write_audit('Registered patient', p_full_name);
  return v_row;
end $$;

-- ---------- the queue ----------
-- The entity model has no queue table, and none is added here. A queue
-- entry is a checked-in appointment: waiting until a nurse records
-- vitals, ready for the doctor afterwards. A walk-in is the same thing
-- with appt_type 'Walk-in'.

create or replace function add_walk_in(p_mrn text, p_doctor uuid default null)
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

  -- Take the first slot today that is not already spoken for, so the
  -- walk-in cannot collide with a booked appointment.
  select s::time into v_slot from free_slots(v_doctor, current_date) s limit 1;
  if v_slot is null then
    raise exception 'That doctor has no free slot left today.';
  end if;

  insert into appointments (mrn, doctor_id, specialty, appt_date, appt_time, appt_type, status)
  values (p_mrn, v_doctor,
          (select department from staff where id = v_doctor),
          current_date, v_slot, 'Walk-in', 'checked_in')
  returning id into v_id;

  perform write_audit('Added walk-in', p_mrn);
  return v_id;
end $$;

create or replace function check_in_appointment(p_appt bigint)
returns void language plpgsql as $$
declare v_mrn text;
begin
  update appointments set status = 'checked_in'
   where id = p_appt and status = 'confirmed'
  returning mrn into v_mrn;

  if v_mrn is null then
    raise exception 'Appointment % is not open for check-in.', p_appt;
  end if;
  perform write_audit('Checked in patient', v_mrn);
end $$;

-- ---------- consultation ----------
-- signEncounter is atomic. One signing stages a laboratory order, a
-- prescription, an invoice line, a timeline entry and possibly a
-- referral, an admission and a follow-up. All of it commits or none of
-- it does, which is why this is one function and not a sequence of
-- client-side inserts.

create or replace function sign_encounter(p jsonb)
returns bigint language plpgsql as $$
declare
  v_enc      bigint;
  v_mrn      text  := p->>'mrn';
  v_doctor   uuid  := auth.uid();
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
  values (v_mrn, v_doctor, coalesce(p->>'complaint',''), trim(p->>'diagnosis'),
          nullif(p->>'notes',''), coalesce((p->>'aiAssisted')::boolean, false))
  returning id into v_enc;

  --  2. staged laboratory orders
  for v_item in select * from jsonb_array_elements(coalesce(p->'labs','[]'::jsonb)) loop
    insert into lab_orders (mrn, encounter_id, ordered_by, test_name, priority, price)
    values (v_mrn, v_enc, v_doctor, v_item->>'testName',
            coalesce((v_item->>'priority')::priority_enum, 'routine'),
            coalesce((v_item->>'price')::numeric, 0));
  end loop;

  --  3. staged imaging
  for v_item in select * from jsonb_array_elements(coalesce(p->'imaging','[]'::jsonb)) loop
    insert into imaging_orders (mrn, encounter_id, ordered_by, modality, body_region, priority, price)
    values (v_mrn, v_enc, v_doctor, v_item->>'modality', v_item->>'bodyRegion',
            coalesce((v_item->>'priority')::priority_enum, 'routine'),
            coalesce((v_item->>'price')::numeric, 0));
  end loop;

  --  4. staged prescriptions
  for v_item in select * from jsonb_array_elements(coalesce(p->'prescriptions','[]'::jsonb)) loop
    insert into prescriptions (mrn, encounter_id, prescriber_id, drug, dose, frequency, duration, quantity)
    values (v_mrn, v_enc, v_doctor, v_item->>'drug', v_item->>'dose',
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
    select s::time into v_slot from free_slots(v_doctor, current_date + v_days) s limit 1;
    if v_slot is not null then
      insert into appointments (mrn, doctor_id, specialty, appt_date, appt_time, appt_type, status)
      values (v_mrn, v_doctor, (select department from staff where id = v_doctor),
              current_date + v_days, v_slot, 'Follow-up', 'confirmed');
    end if;
  end if;

  --  8. the consultation fee. Charge capture happens at the clinical
  --     event, not reconstructed later.
  perform add_invoice_line(v_mrn, 'Consultation', v_fee);

  --  9. audit
  select full_name into v_name from patients where mrn = v_mrn;
  perform write_audit('Signed consultation', coalesce(v_name, v_mrn));

  -- 10. clear the patient from the doctor's queue
  update appointments set status = 'completed'
   where mrn = v_mrn and doctor_id = v_doctor
     and appt_date = current_date and status = 'checked_in';

  update patients set last_visit = current_date where mrn = v_mrn;

  return v_enc;
end $$;

-- ---------- wards ----------

create or replace function admit_patient(p_mrn text, p_ward text, p_bed text)
returns void language plpgsql as $$
begin
  update ward_beds set mrn = p_mrn, admitted_at = now()
   where ward = p_ward and bed_no = p_bed and mrn is null;
  if not found then
    raise exception 'Bed % in % is not free.', p_bed, p_ward;
  end if;
  perform write_audit('Admitted patient', p_mrn || ' to ' || p_ward || ' ' || p_bed);
end $$;

-- Discharge frees the bed AND writes the summary, in one transaction.
create or replace function discharge_patient(p_ward text, p_bed text)
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
          'Discharge summary', v_body, auth.uid());

  update ward_beds set mrn = null, admitted_at = null
   where ward = p_ward and bed_no = p_bed;

  perform write_audit('Discharged patient', coalesce(v_name, v_mrn));
end $$;

-- The medication round. There is no MAR table in the entity model and
-- none is added; an administration is recorded as an audit entry, which
-- is append-only and already the system's record of who did what.
create or replace function record_administration(p_rx bigint)
returns void language plpgsql as $$
declare v_drug text; v_mrn text; v_name text;
begin
  select r.drug, r.mrn, p.full_name into v_drug, v_mrn, v_name
    from prescriptions r join patients p on p.mrn = r.mrn
   where r.id = p_rx;
  if v_drug is null then
    raise exception 'Prescription % does not exist.', p_rx;
  end if;
  perform write_audit('Administered medication',
                      coalesce(v_name, v_mrn) || ' — ' || v_drug || ' (rx ' || p_rx || ')');
end $$;

-- ---------- billing ----------
-- The audit entry must name the provider, e.g.
--   Payment recorded (MoMo · MTN MoMo) INV-2100

create or replace function record_payment(
  p_invoice text, p_amount numeric, p_method text, p_provider text default null
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
  perform write_audit(v_label, coalesce(v_name, v_mrn));

  insert into notifications (mrn, kind, title, body)
  values (v_mrn, 'billing', 'Payment received',
          'We have recorded ' || to_char(p_amount, 'FM999999990.00') ||
          ' against ' || p_invoice || '.');
end $$;

-- notifications has no insert policy, so the writer must be definer.
-- Same reasoning the handoff gives for invoice lines.
alter function record_payment(text, numeric, text, text) security definer;

create or replace function advance_claim(p_claim text)
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
  perform write_audit('Claim ' || v_new::text, p_claim);
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

-- ---------- medication round ----------
-- Inpatients only: a pending prescription for a patient who occupies a bed.

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
