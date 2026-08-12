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
