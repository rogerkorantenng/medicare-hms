// Creates the auth accounts the seed data attaches staff and patient rows to.
//
//   node --env-file=.env.local scripts/create-users.mjs
//
// Run this AFTER 0001_schema.sql and 0002_rls_policies.sql, and BEFORE
// 0003_seed.sql — the seed looks these users up by email and will fail on the
// staff foreign key if they do not exist yet.
//
// This is the only place in the repository that uses the service-role key. It
// bypasses row-level security, which is exactly why it runs from a terminal
// and never on a request.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD; // set this, do not hard-code

if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
  process.exit(1);
}
if (!password) {
  console.error('Set DEMO_PASSWORD. It becomes the examiner password in Links.txt.');
  process.exit(1);
}
if (password.length < 12) {
  console.error('DEMO_PASSWORD is short. Use at least 12 characters — this account is public.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// The nine sign-in accounts, matching the login screen in the design.
const users = [
  ['patient@medicare.com',   'patient'],
  ['doctor@medicare.com',    'doctor'],
  ['nurse@medicare.com',     'nurse'],
  ['reception@medicare.com', 'receptionist'],
  ['lab@medicare.com',       'lab'],
  ['radiology@medicare.com', 'radiology'],
  ['pharmacy@medicare.com',  'pharmacist'],
  ['cashier@medicare.com',   'cashier'],
  ['admin@medicare.com',     'admin'],
];

// The three roster doctors. schema.sql makes staff.id a foreign key to
// auth.users, so schedulable staff still need an auth row — but they get no
// password, so nobody can sign in as them. See supabase/DEVIATIONS.md.
const rosterDoctors = [
  'emily.parker@medicare.com',
  'lisa.thompson@medicare.com',
  'james.wilson@medicare.com',
];

async function upsertUser(email, role, withPassword) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    ...(withPassword ? { password } : {}),
    email_confirm: true,
    app_metadata: { role },
  });

  if (!error) return { status: 'created', id: data.user.id };

  // Re-running the script should be safe.
  if (/already been registered|already exists/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users.find((u) => u.email === email);
    if (!existing) return { status: 'failed', message: error.message };

    await admin.auth.admin.updateUserById(existing.id, {
      ...(withPassword ? { password } : {}),
      app_metadata: { role },
    });
    return { status: 'updated', id: existing.id };
  }

  return { status: 'failed', message: error.message };
}

let failures = 0;

console.log('Sign-in accounts');
for (const [email, role] of users) {
  const r = await upsertUser(email, role, true);
  if (r.status === 'failed') { failures++; console.log(`  FAIL ${email}: ${r.message}`); }
  else console.log(`  ${r.status.padEnd(7)} ${email.padEnd(26)} -> ${role}`);
}

console.log('\nRoster doctors (schedulable, no password, cannot sign in)');
for (const email of rosterDoctors) {
  const r = await upsertUser(email, 'doctor', false);
  if (r.status === 'failed') { failures++; console.log(`  FAIL ${email}: ${r.message}`); }
  else console.log(`  ${r.status.padEnd(7)} ${email}`);
}

if (failures) {
  console.error(`\n${failures} account(s) failed. Fix these before running 0003_seed.sql.`);
  process.exit(1);
}

console.log('\nAll 12 auth users are in place. Next: run supabase/migrations/0003_seed.sql.');
