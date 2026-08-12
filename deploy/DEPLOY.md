# Deploying MediCare+ HMS

About fifteen minutes end to end. Everything in `deploy/` has been tested
against a real PostgreSQL 16 first, so the SQL should run without surprises.

Your Supabase project: **`vjzlxbxozqrcmzhctgxs`** (eu-west-1). It was paused
and has been restored — if it has slept again, open it in the dashboard and
let it wake before starting.

---

## 1. Database — two pastes and one script

Supabase dashboard → **SQL Editor** → New query.

### Paste 1

Copy the whole of **`deploy/1-schema-and-rls.sql`** and run it.

That is `0001_schema.sql` and `0002_rls_policies.sql` concatenated: 16 tables,
constraints, triggers, and row-level security on every one of them.

Expect: `Success. No rows returned.`

### Then create the auth accounts

Locally, with `.env.local` filled in:

```bash
node --env-file=.env.local scripts/create-users.mjs
```

You need `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`DEMO_PASSWORD` set. The script refuses a password under 12 characters,
because this one ends up in `Links.txt` as the examiner credential.

It creates twelve users: the nine sign-in accounts, plus three roster doctors
with **no password** so they are schedulable but nobody can sign in as them.
Re-running it is safe.

Expect to see `created` or `updated` against all twelve, then:

```
All 12 auth users are in place. Next: run supabase/migrations/0003_seed.sql.
```

### Paste 2

Copy the whole of **`deploy/2-seed-and-functions.sql`** and run it.

That is `0003_seed.sql` and `0004_functions.sql`: 28 patients, six wards, 34
beds, the inventory, open work in every department, and the application
functions.

**This will fail if the auth users do not exist yet** — that is the foreign
key doing its job, not a bug. Run the script first.

### Check it landed

```sql
select count(*) from patients;   -- 28
select count(*) from staff;      -- 11
select id, total, paid, status from invoices order by id;
```

The invoice totals must be non-zero:

```
INV-2088  360.00  360.00  paid
INV-2089  200.00    0.00  unpaid
INV-2090  165.00    0.00  unpaid
INV-2091  165.00    0.00  unpaid
```

If they are zero, the total-sync trigger is not firing and paste 1 did not
complete.

---

## 2. Deploy to Vercel

1. Push this repository to GitHub.
2. Import it at vercel.com. Next.js is detected automatically; no build
   settings to change.
3. Add these under **Project Settings → Environment Variables**, ticked for
   Production, Preview and Development:

   | Variable | Reaches the browser? |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | yes, by design |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes, by design — its power is bounded by row-level security |
   | `SUPABASE_SERVICE_ROLE_KEY` | **no — server only, bypasses RLS** |
   | `ANTHROPIC_API_KEY` | **no — server only** |
   | `DEMO_PASSWORD` | no (only used by the user-creation script) |

4. Deploy.
5. Supabase dashboard → **Authentication → URL Configuration** → add the
   Vercel production URL to **Redirect URLs**. Sign-in will not survive a
   refresh without this.

---

## 3. The step 2 acceptance test

This is the one that cannot be faked locally, because only Supabase Auth
issues a real JWT. **Do not use the service-role key** — it bypasses
row-level security and will give you a false pass.

Sign in to the deployed app as each role and confirm:

| Signed in as | Check | Expected |
|---|---|---|
| Cashier | Open any patient chart | Restriction notice; Timeline, Vitals, Results and Medications all empty |
| Cashier | Billing tab on the same chart | Invoices and lines visible |
| Receptionist | Patients list | 28 patients |
| Receptionist | Any chart, Timeline tab | Empty |
| Patient | Records | Only Sarah Johnson's own data |
| Doctor | Dashboard | Queue and orders visible |

The cashier seeing an empty Timeline is not the screen hiding anything. The
rows were never sent.

---

## 4. Post-deployment checks

Run these against the **deployed** build, not the dev server. Two v1.0 defects
appeared only after deployment.

- [ ] Sign in as each of the nine roles — correct navigation, no extra items
- [ ] Book a slot, then try the same slot again — refused, struck through
- [ ] Prescribe Amoxicillin for Sarah Johnson (penicillin allergy) — blocked,
      allergy named, and no override button anywhere
- [ ] Advance a lab order to verified with a critical flag — banner reaches
      the ordering doctor
- [ ] Dispense a prescription — stock decrements, invoice line appears
- [ ] Record a MoMo payment — invoice settles, audit names the provider
- [ ] Refresh mid-journey — nothing lost
- [ ] Open on two devices, same account — same data on both
- [ ] Network tab during an AI call — no API key visible
- [ ] Ask the Ops Copilot a question — the answer matches the dashboard
- [ ] All fonts and icons render — no broken glyphs

The last one should hold regardless: fonts and icons are served from the
application's own origin, not from Google.

---

## 5. Fill in Links.txt

- Live application URL — the Vercel production URL
- Administrator URL — the same address; sign in with `admin@medicare.com`
- Test-user credentials — one per role, all using `DEMO_PASSWORD`
- Administrator credentials — `admin@medicare.com` and `DEMO_PASSWORD`
- Source-code repository link

---

## One thing to watch

The project is on the free tier, which pauses after a week of inactivity. A
paused project loses no data, but the examiner would meet an error page.
Either wake it before submitting, or take one month of Pro and cancel after
marking.
