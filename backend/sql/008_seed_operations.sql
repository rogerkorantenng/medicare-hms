-- ---------------------------------------------------------------------
-- Seeds the tables that replaced hardcoded lists, with exactly the
-- values that were hardcoded. Nothing about the running system changes;
-- the data simply moved somewhere it can be edited.
-- ---------------------------------------------------------------------

-- ---------- laboratory catalogue ----------
-- Previously an array in the consultation screen's TypeScript.

insert into catalogue_items (kind, name, price) values
  ('lab', 'Complete Blood Count',   35.00),
  ('lab', 'Lipid Panel',            45.00),
  ('lab', 'Troponin I',             80.00),
  ('lab', 'Serum Potassium',        30.00),
  ('lab', 'HbA1c',                  60.00),
  ('lab', 'Liver Function Tests',   55.00),
  ('lab', 'Malaria RDT',            20.00),
  ('lab', 'Urinalysis',             25.00),
  ('lab', 'Blood Culture',          90.00),
  ('lab', 'Thyroid Function Tests', 70.00),
  ('lab', 'Serum Creatinine',       30.00),
  ('lab', 'Fasting Blood Glucose',  20.00)
on conflict do nothing;

-- ---------- imaging catalogue ----------

insert into catalogue_items (kind, name, body_region, price) values
  ('imaging', 'X-Ray',      'Chest',   120.00),
  ('imaging', 'X-Ray',      'Limb',    100.00),
  ('imaging', 'Ultrasound', 'Abdomen', 180.00),
  ('imaging', 'Ultrasound', 'Pelvis',  180.00),
  ('imaging', 'CT',         'Head',    450.00),
  ('imaging', 'CT',         'Chest',   500.00),
  ('imaging', 'MRI',        'Spine',   800.00),
  ('imaging', 'ECG',        'Cardiac',  60.00)
on conflict do nothing;

-- ---------- tariff ----------
-- The consultation fee was the literal 120 in the consultation screen.

insert into catalogue_items (kind, name, price) values
  ('tariff', 'Consultation',            120.00),
  ('tariff', 'Specialist consultation', 200.00),
  ('tariff', 'Review',                   80.00),
  ('tariff', 'Dressing',                 40.00),
  ('tariff', 'Injection',                25.00),
  ('tariff', 'Bed-day, general ward',   150.00),
  ('tariff', 'Bed-day, private wing',   400.00)
on conflict do nothing;

-- ---------- departments ----------

insert into departments (name) values
  ('Cardiology'), ('Neurology'), ('Dermatology'), ('Orthopaedics'),
  ('General Medicine'), ('Outpatient'), ('Front Desk'), ('Laboratory'),
  ('Radiology'), ('Pharmacy'), ('Accounts'), ('Administration'),
  ('Maternity'), ('Paediatrics')
on conflict do nothing;

-- ---------- doctor rosters ----------
-- Monday to Friday for the clinical doctors, which is what the fixed
-- array was pretending to be. Weekends are now genuinely closed, and
-- each doctor can be given different hours from the Staff screen.

do $$
declare
  v_doctor record;
begin
  for v_doctor in select id, staff_no from staff where role = 'doctor' loop
    -- Mornings, every weekday.
    insert into doctor_schedules (doctor_id, day_of_week, starts_at, ends_at, slot_minutes)
      select v_doctor.id, d, '09:00', '12:00', 30 from generate_series(1, 5) d
      where not exists (
        select 1 from doctor_schedules
         where doctor_id = v_doctor.id and day_of_week = d and starts_at = '09:00');

    -- Afternoons, Monday to Thursday. ST-001 also runs a Friday clinic.
    insert into doctor_schedules (doctor_id, day_of_week, starts_at, ends_at, slot_minutes)
      select v_doctor.id, d, '14:00', '17:00', 30
        from generate_series(1, case when v_doctor.staff_no = 'ST-001' then 5 else 4 end) d
      where not exists (
        select 1 from doctor_schedules
         where doctor_id = v_doctor.id and day_of_week = d and starts_at = '14:00');
  end loop;
end $$;

-- One doctor on leave next week, so the booking screen has something to
-- demonstrate beyond the happy path.
insert into doctor_leave (doctor_id, starts_on, ends_on, reason)
  select id, current_date + 7, current_date + 11, 'Annual leave'
    from staff where staff_no = 'ST-010'
   and not exists (select 1 from doctor_leave where reason = 'Annual leave')
on conflict do nothing;

-- ---------- opening stock movements ----------
-- Every item gets the movement that explains the quantity it starts
-- with, so the ledger reconciles from the first day.

insert into stock_movements (item_id, kind, quantity, reason)
  select id, 'received', quantity, 'Opening stock' from inventory_items
   where not exists (select 1 from stock_movements where reason = 'Opening stock');
