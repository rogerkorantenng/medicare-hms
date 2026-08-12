-- LOCAL VERIFICATION ONLY. On Supabase these users are created by
-- scripts/create-users.mjs through the Admin API, which also sets the
-- password and the role in app_metadata.
--
-- Nine sign-in accounts, one per role.
insert into auth.users (email, raw_app_meta_data) values
  ('patient@medicare.com',   '{"role":"patient"}'),
  ('doctor@medicare.com',    '{"role":"doctor"}'),
  ('nurse@medicare.com',     '{"role":"nurse"}'),
  ('reception@medicare.com', '{"role":"receptionist"}'),
  ('lab@medicare.com',       '{"role":"lab"}'),
  ('radiology@medicare.com', '{"role":"radiology"}'),
  ('pharmacy@medicare.com',  '{"role":"pharmacist"}'),
  ('cashier@medicare.com',   '{"role":"cashier"}'),
  ('admin@medicare.com',     '{"role":"admin"}');

-- Three roster doctors. Schedulable staff with no password, so they
-- appear in the booking roster but nobody can sign in as them. See the
-- deviation note in 0003_seed.sql.
insert into auth.users (email, raw_app_meta_data) values
  ('emily.parker@medicare.com',  '{"role":"doctor"}'),
  ('lisa.thompson@medicare.com', '{"role":"doctor"}'),
  ('james.wilson@medicare.com',  '{"role":"doctor"}');
