# Deployment: Supabase and Vercel

Migration steps 1, 2, 5 and 6. Work through in order.

## 1. Create the Supabase project

1. New project at supabase.com. Choose the region closest to Ghana; `eu-west` is
   usually the lowest latency available.
2. Save the database password somewhere safe. It is not recoverable.
3. From Project Settings, API, copy:
   - Project URL
   - `anon` public key
   - `service_role` key — **server-side only, never in client code**

## 2. Run the migrations

In the SQL editor, in this order:

```
schema.sql        -- 16 tables, constraints, triggers, functions
rls-policies.sql  -- row-level security, the important one
```

Then run the verification block at the bottom of `schema.sql`. **Every one of the
nine checks must fail.** If any succeeds, the schema is wrong; fix it before going
further.

Then run the verification block at the bottom of `rls-policies.sql`, signed in as
each role through the client. Do not use the service-role key for this — it bypasses
row-level security and will give you a false pass.

## 3. Create the nine role accounts

```js
// scripts/create-users.mjs
// node --env-file=.env.local scripts/create-users.mjs
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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

const password = process.env.DEMO_PASSWORD;   // set this, do not hard-code

for (const [email, role] of users) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { role },
  });
  console.log(error ? \`FAIL \${email}: \${error.message}\` : \`ok \${email} -> \${role}\`);
}
```

Then run `seed.sql`, which attaches the staff rows and loads the 28 patients,
wards, inventory and open work.

Run the verification block at the bottom of `seed.sql`. Invoice totals must be
non-zero; if they are zero the total-sync trigger is not firing.

## 4. Environment variables

`.env.local` for development, and the same keys in the Vercel dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server only
ANTHROPIC_API_KEY=<key>                        # server only
DEMO_PASSWORD=<the examiner password>
```

**Only the two `NEXT_PUBLIC_` values may reach the browser.** The service-role key
and the Anthropic key are server-side only. This is migration step 5 and its
acceptance criterion is that neither appears in any client request. Check the
network tab before you call it done.

Add `.env.local` to `.gitignore`. The coursework states explicitly that
credentials must not be committed to a publicly accessible repository.

## 5. Deploy to Vercel

1. Push the repository to GitHub.
2. Import it at vercel.com. Next.js is detected automatically.
3. Add all five environment variables in Project Settings, Environment Variables,
   for Production, Preview and Development.
4. Deploy. Every push to `main` deploys from then on.
5. Add the Vercel production URL to Supabase, Authentication, URL Configuration,
   Redirect URLs.

## 6. Backup and restore — step 6

Supabase takes daily backups on paid plans. On the free plan, schedule your own:

```bash
pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges > backup-$(date +%F).sql
```

**The acceptance criterion is a restore you have actually performed**, onto a fresh
Supabase project, not a backup you merely possess. The submitted maintenance plan
words this as: a backup nobody has restored is a hope, not a backup.

## 7. Record the access details

Fill in `Links.txt` in the submission package:

- Live application URL, the Vercel production URL
- Administrator URL, the same address; the administrator workspace is reached by
  signing in with the admin account
- Test-user credentials, one per role
- Administrator credentials
- Source-code repository link

## Post-deployment checks

Run these against the deployed build, not the development build. Two v1.0 defects
appeared only after deployment because external assets were unreachable, and the
submitted testing report records that lesson.

| Check | Expected |
|---|---|
| Sign in as each of the nine roles | Correct navigation set, no extra items |
| Cashier opens a patient chart | Restriction notice, no clinical data rendered |
| Patient app on a real phone | Layout correct from 360px, targets at least 44px |
| Book a slot, then retry the same slot | Second attempt refused, slot struck through |
| Prescribe Amoxicillin for a penicillin-allergic patient | Blocked, allergy named |
| Advance a lab order to verified with a critical flag | Banner reaches the ordering doctor |
| Dispense a prescription | Stock decrements, invoice line appears |
| Record a MoMo payment | Invoice settles, audit entry names the provider |
| Refresh mid-journey | Nothing lost, same state |
| Open on two devices, same account | Same data on both — this is what the migration was for |
| Network tab during an AI call | No API key visible |
| Ask the Ops Copilot a question | Answer matches the dashboard figures |
| All fonts and icons render | No broken glyphs, no missing images |

## Two things to get right

**Do not bypass row-level security for convenience.** If a query returns nothing
and you are tempted to reach for the service-role key on the client, the policy is
telling you something. The whole point of step 2 is that authorisation stops being
a UI convention.

**Do not let the code and the documentation drift apart.** Six academic documents
describe this system's architecture, its 16-entity model and this six-step
migration. An examiner will compare them. If you change something structural,
flag it so the documentation can be updated to match.
