-- ---------------------------------------------------------------------
-- A hospital that is mid-morning, not one that has just opened.
--
-- The handoff seed loaded people, stock, beds and money, but no clinical
-- activity: every appointment sat at 'confirmed', and there were no
-- vitals and no encounters. A queue entry is a checked-in appointment
-- for today, so the queue was necessarily empty, and with it the
-- receptionist, nurse and doctor dashboards, which are three of the nine.
-- The submitted documentation promises that every screen has content on
-- first visit. This file is what makes that true.
--
-- Everything here is derived from the same five named patients, so the
-- walkthrough in the user manual still works and nothing contradicts the
-- records the earlier file wrote.
-- ---------------------------------------------------------------------

-- ---------- 1. today's clinic list ----------
-- Four already checked in, so the queue has depth, and two still to
-- arrive so the front desk has something to check in.

update appointments set status = 'checked_in'
 where mrn in ('PT-20481','PT-20518') and appt_date = current_date;

insert into appointments (mrn, doctor_id, specialty, appt_date, appt_time, appt_type, status) values
  ('PT-20492', (select id from staff where staff_no='ST-001'), 'Cardiology',
   current_date, '09:20', 'Follow-up',    'checked_in'),
  ('PT-20536', (select id from staff where staff_no='ST-001'), 'Cardiology',
   current_date, '09:40', 'Consultation', 'checked_in'),
  ('PT-20551', (select id from staff where staff_no='ST-001'), 'Cardiology',
   current_date, '11:15', 'Consultation', 'confirmed'),
  ('PT-20524', (select id from staff where staff_no='ST-009'), 'Neurology',
   current_date, '11:45', 'Review',       'confirmed');

-- ---------- 2. vitals, so triage has been half done ----------
-- Two of the four checked-in patients have been through triage and are
-- ready for the doctor. The other two are still the nurse's work, which
-- is what gives the triage screen something to do.
--
-- Comfort Baidoo is deliberately the urgent one: she is the patient whose
-- STAT troponin is in the laboratory, so the story holds together from
-- the queue through to the critical result.

insert into vitals (mrn, recorded_by, systolic, diastolic, temperature, pulse, spo2, weight_kg, acuity, recorded_at) values
  ('PT-20536', (select id from staff where staff_no='ST-002'),
   168, 96, 37.4, 104, 95, 78.5, 'urgent',       now() - interval '35 minutes'),
  ('PT-20481', (select id from staff where staff_no='ST-002'),
   138, 86, 36.8,  78, 98, 64.0, 'semi_urgent',  now() - interval '20 minutes');

-- ---------- 3. consultation history ----------
-- So a chart opens onto a record rather than an empty tab, and so the
-- doctor's own list of past work is not blank.

insert into encounters (mrn, doctor_id, complaint, diagnosis, notes, ai_assisted, created_at) values
  ('PT-20481', (select id from staff where staff_no='ST-001'),
   'Headache and dizziness on standing',
   'I10 Essential (primary) hypertension',
   'Blood pressure remains above target on current therapy. Continue lisinopril 10mg daily, '
   'review in four weeks with a repeat lipid panel. Advised on salt intake and home monitoring.',
   false, now() - interval '5 days'),
  ('PT-20492', (select id from staff where staff_no='ST-001'),
   'Routine diabetic review, occasional numbness in both feet',
   'E11.4 Type 2 diabetes mellitus with neurological complications',
   'Glycaemic control acceptable. Early peripheral neuropathy suspected. Referred to '
   'endocrinology, foot care advice given, review in three months.',
   false, now() - interval '3 days'),
  ('PT-20518', (select id from staff where staff_no='ST-009'),
   'Recurrent morning headaches for three weeks',
   'G43.9 Migraine, unspecified',
   'Pattern and duration consistent with migraine. Complete blood count requested to exclude '
   'anaemia. Trigger diary advised.',
   false, now() - interval '1 day');

-- ---------- 4. alerts ----------
-- The bell is part of the interface and an empty bell reads as a broken
-- one. Addressed to the doctor by staff id and to the patient by MRN,
-- which is exactly how the notifications policy scopes them.

insert into notifications (staff_id, mrn, kind, title, body, is_read, created_at) values
  ((select id from staff where staff_no='ST-001'), null, 'critical',
   'Blood pressure 168/96 recorded for Comfort Baidoo',
   'Triage flagged this reading as urgent. She is in your queue with a STAT troponin pending.',
   false, now() - interval '30 minutes'),
  ((select id from staff where staff_no='ST-001'), null, 'info',
   'Complete Blood Count in progress for Fatima Al-Hassan',
   'The laboratory has the sample. The result releases to the chart on verification.',
   false, now() - interval '2 hours'),
  ((select id from staff where staff_no='ST-002'), null, 'info',
   'Two patients waiting for triage',
   'Kwame Mensah and Sarah Johnson are checked in and waiting for vitals.',
   false, now() - interval '15 minutes'),
  (null, 'PT-20481', 'info',
   'Your Lipid Panel result is ready',
   'Your care team has released a result to your records.',
   false, now() - interval '1 day');

-- ---------- 5. the trail those actions would have left ----------

insert into audit_entries (actor_name, action, target, occurred_at) values
  ('Akosua Darko','Checked in patient','Sarah Johnson',      now() - interval '50 minutes'),
  ('Akosua Darko','Checked in patient','Comfort Baidoo',     now() - interval '45 minutes'),
  ('Akosua Darko','Checked in patient','Kwame Mensah',       now() - interval '40 minutes'),
  ('Akosua Darko','Checked in patient','Fatima Al-Hassan',   now() - interval '38 minutes'),
  ('Grace Adjei','Recorded vitals','Comfort Baidoo',         now() - interval '35 minutes'),
  ('Grace Adjei','Recorded vitals','Sarah Johnson',          now() - interval '20 minutes'),
  ('Dr. Michael Chen','Signed consultation','Kwame Mensah',  now() - interval '3 days'),
  ('Dr. Emily Parker','Signed consultation','Fatima Al-Hassan', now() - interval '1 day'),
  ('Kwesi Antwi','Collected sample','Troponin I',            now() - interval '25 minutes'),
  ('Yaa Frimpong','Dispensed medication','Lisinopril 10mg',  now() - interval '6 hours');
