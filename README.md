# MediCare+ Hospital Management System

A hospital management system for MediCare+ General Hospital: a staff workspace
covering eight roles and a patient application, sharing one patient record
rather than nine copies of it.

Built with Next.js 14 and Supabase. This is version 2.0 — the migration of a
working browser-storage prototype onto a real database, which is what makes it
a system rather than a demonstration.

> All data in this system is synthetic. No real patient data appears anywhere.

---

## What changed in this version, and why it matters

Version 1.0 kept everything in browser storage. Two people could not see the
same record, and the submitted documentation named authorisation-in-the-client
as the system's honest weakness. This version closes both.

| Concern | v1.0 | v2.0 |
|---|---|---|
| Storage | Browser, per device | PostgreSQL on Supabase |
| Authorisation | Enforced in the interface | Enforced by row-level security in the database |
| AI calls | From the browser, key exposed | Server-side route handlers, key never sent |
| Result release | Application convention | Database trigger on the verify transition |
| Audit trail | Editable rows | Append-only, no update or delete policy for anyone |

The test that matters: sign in as a cashier and query the consultations table
directly. You get zero rows. Not a hidden tab — zero rows.

---

## Running it

```bash
npm install
cp .env.local.example .env.local     # fill in your Supabase and Anthropic keys
npm run dev
```

### Setting up the database

Run these in order. Steps 1 and 2 come from the design handoff; 4 adds the
operations the repository contract requires to be atomic.

```bash
# 1. In the Supabase SQL editor, in this order:
supabase/migrations/0001_schema.sql          # 16 tables, constraints, triggers
supabase/migrations/0002_rls_policies.sql    # row-level security — the important one

# 2. Create the auth accounts (needs SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD)
node --env-file=.env.local scripts/create-users.mjs

# 3. Back in the SQL editor:
supabase/migrations/0003_seed.sql            # 28 patients, wards, inventory, open work
supabase/migrations/0004_functions.sql       # sign_encounter, free_slots, discharge, payments
```

### Verifying the database before you trust it

```bash
./supabase/verify/run.sh
```

This rebuilds a throwaway PostgreSQL database from the migration files and runs
every acceptance block the handoff specifies:

- **Step 1** — all nine schema constraints must *reject*. Empty diagnosis,
  double booking, one patient in two beds, skipping a laboratory stage,
  verifying with no value, over-dispensing, a claim moving backwards,
  implausible vitals, writing the generated invoice status.
- **Step 2** — 20 row-level security checks across six roles.
- **Step 3** — seed counts, and invoice totals actually synced by the trigger.
- **Step 4** — `sign_encounter` is atomic, `free_slots` excludes bookings,
  discharge writes its summary, payment names the MoMo provider in the audit.

The checks run as the `authenticated` database role, never as the table owner
or a superuser — either of those bypasses row-level security and would give a
false pass.

**This does not replace the real step 2 acceptance test.** That has to be run
against Supabase signed in as each role through the client, because only
Supabase Auth issues a real JWT. Do not use the service-role key for it.

Four defects in the handoff SQL were found by running these checks. They are
documented in [`supabase/DEVIATIONS.md`](supabase/DEVIATIONS.md) rather than
changed quietly — three of them stopped the SQL executing at all.

---

## How it is put together

```
app/
  workspace/        staff, one directory per role
  app/              the patient application
  print/            prescription slip, receipt, discharge summary
  api/ai/           six route handlers, each role-gated
  actions.ts        server actions — every write goes through here
lib/
  repository/       the single boundary between UI and database
    types.ts        the Repository interface
    supabase.ts     the implementation
    safety.ts       deterministic rules — never AI
    index.ts        the construction point
  supabase/         clients: server (session cookie), browser (anon key only)
supabase/
  migrations/       the SQL, in run order
  verify/           the local acceptance harness
  DEVIATIONS.md     what was wrong in the handoff, and why it changed
```

### The repository is the only boundary

No screen imports Supabase. Screens import `repo` and nothing else, so
swapping storage is one line in `lib/repository/index.ts` — which is exactly
how the browser-storage version was replaced.

Every query runs through a server client built from the caller's session
cookie, so every query carries that user's JWT and row-level security applies.
The service-role key appears in exactly one file, `scripts/create-users.mjs`,
which runs from a terminal and never on a request.

### Some rules are deliberately not AI

The prescription safety check and the triage acuity suggestion are ordinary
code in `lib/repository/safety.ts`. A safety block has to be reproducible and
explainable — the acuity panel lists the readings that drove its answer, not
just the answer.

A blocked prescription **cannot be forced through from the screen**. There is
no override button, by design: a clinician who judges the drug necessary
despite the conflict arranges it with the pharmacist directly.

### Where AI is used

Six features, all server-side, all role-gated, all landing in an editable
field that a human accepts or discards. Output renders in purple with a
sparkle so a suggestion is never confusable with a recorded fact. If a call
fails, the feature shows a plain message and the workflow continues manually —
a clinical action is never blocked on an AI response.

Autonomous clinical decision-making is excluded permanently, not pending.

---

## Assets

Fonts and icons are committed to `public/fonts` and served from this origin.
Nothing is fetched from Google at build time or at run time. Two v1.0 defects
were caused by unreachable external assets in the deployed build, which is why
the design uses an icon font and initials tiles rather than photographs in the
first place. Material Symbols is subsetted to the 70 icons actually used —
60 KB rather than the full 3 MB.

## Deploying

See [`project/design_handoff_medicare_backend/deployment.md`](project/design_handoff_medicare_backend/deployment.md)
for the full sequence, including the post-deployment checks to run against the
deployed build rather than the development one.

Only the two `NEXT_PUBLIC_` values may reach the browser. The service-role key
and the Anthropic key are server-side only, and the acceptance criterion for
that step is that neither appears in any client request. Check the network tab
before calling it done.
