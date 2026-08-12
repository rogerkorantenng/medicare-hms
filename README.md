# MediCare+ Hospital Management System

A hospital management system for MediCare+ General Hospital: a staff workspace
covering eight roles and a patient application, sharing one patient record
rather than nine copies of it.

Next.js on the front, FastAPI over PostgreSQL behind it. This is version 2.0 —
the migration of a working browser-storage prototype onto a real database and a
real API, which is what makes it a system rather than a demonstration.

> All data in this system is synthetic. No real patient data appears anywhere.

---

## What changed in this version, and why it matters

Version 1.0 kept everything in browser storage. Two people could not see the
same record, and the submitted documentation named authorisation-in-the-client
as the system's honest weakness. This version closes both.

| Concern | v1.0 | v2.0 |
|---|---|---|
| Storage | Browser, per device | PostgreSQL on Amazon RDS |
| Authorisation | Enforced in the interface | Enforced by guards in the API, on every route |
| Sessions | In memory | JWT issued by the API, in an httpOnly cookie |
| Passwords | A hardcoded list | argon2id hashes in a `users` table |
| AI calls | From the browser, key exposed | From the API, through an IAM role — no key exists |
| Result release | Application convention | Database trigger on the verify transition |
| Audit trail | Editable rows | Append-only: the API exposes no write route, and a test asserts it |
| Security tests | 6, run by hand | 20, automated, run against the API and again through the browser surface |

The test that matters: sign in as a cashier and open a patient chart. You get
demographics and invoices. Not a hidden tab — the clinical arrays come back
empty, because a different query ran.

---

## Running the whole thing locally

```bash
docker compose up --build          # database, API and frontend
docker compose run --rm seed       # schema, functions, accounts, seed data
```

Then <http://localhost:3000>, and sign in with any of the nine role accounts.
If those ports are taken:

```bash
API_PORT=8010 WEB_PORT=3010 docker compose up
```

The database image matches the RDS engine version and the API image is the one
App Runner runs, so nothing behaves differently between a laptop and AWS.

### Or each part on its own

```bash
cd backend  && cp .env.example .env       && uv run uvicorn app.main:app --reload
cd frontend && cp .env.local.example .env.local && npm install && npm run dev
```

---

## Verifying it

Four suites. All four pass; run them in this order.

```bash
cd backend && uv run pytest                 # 74 tests, about two seconds
./scripts/verify-screens.sh                 # 30 screens load as their owning role
./scripts/verify-e2e.sh                     # 39 checks through the browser surface
```

`backend/tests/test_authorisation.py` is the one to read first. Moving
authorisation out of the database into the API was a deliberate decision, and
its cost is that the database will now hand any row to whatever asks. These
tests are what stands in for the guarantee row-level security used to give —
they exercise the cases the Testing Report lists as TC-95 to TC-114. The file
says so in its opening lines: **if one of these fails, it is a data leak, not a
failing test.**

`verify-screens.sh` exists because a server component that throws renders as a
generic error page, which is easy to miss by clicking around. It found a real
one: the patient booking screen asked for the staff directory, which is
staff-only.

Row-level security *was* built first and tested against a real PostgreSQL
instance before it was replaced. That work found four defects in the original
handoff SQL, three of which stopped it executing at all, and the two worth
knowing about are recorded as D-15 and D-16 in the Testing Report: policy
helper functions that recursed during query *planning* rather than execution,
and a trigger that could never fire because it inserted into a table whose
policies forbade it. The reasoning for the replacement is in Design
Documentation §9.4.

---

## How it is put together

```
backend/
  app/
    security/       THE authorisation boundary — roles, guards, tokens, deps
    routers/        63 operations, each carrying a role guard
    queries/        chart.py holds the three views: clinical, own, billing
    safety.py       deterministic prescribing rules — never AI
    prompts.py      the six system prompts, verbatim, in one file
    ai.py           Bedrock and Anthropic behind one function that never raises
  sql/              schema, functions, seed — plain PostgreSQL
  scripts/seed.py   builds a database from nothing
  tests/            74 tests
frontend/
  app/
    workspace/      staff, one directory per role
    app/            the patient application
    print/          prescription slip, receipt, discharge summary
    api/session/    sign-in and sign-out; puts the token in an httpOnly cookie
    api/ai/[route]/ one proxy for all six AI features
    actions.ts      server actions — every write goes through here
  lib/
    repository/     the single boundary between UI and API
      types.ts      the Repository interface
      http.ts       the implementation
      index.ts      the construction point
    api/client.ts   attaches the bearer token, server-side only
    session.ts      who is asking
deploy/aws/         six idempotent scripts that build the whole deployment
scripts/            the end-to-end verification suites, and the screenshot harness
```

### The repository is still the only boundary

No screen imports an HTTP client. Screens import `repo` and nothing else, so
swapping storage is one line in `frontend/lib/repository/index.ts`. That same
interface has now been satisfied three ways, the last of them HTTP against
FastAPI, and no screen changed for any of them.

### The authorisation boundary is one directory

`backend/app/security/` decides everything. A route without a guard is a data
leak rather than a bug, which is why `deps.py` says so in a comment and why the
tests above exist. The role is re-read from the database on each request rather
than trusted from the token.

### Some rules are deliberately not AI

The prescription safety check and the triage acuity suggestion are ordinary
code in `backend/app/safety.py`. A safety block has to be reproducible and
explainable — the acuity panel lists the readings that drove its answer, not
just the answer.

A blocked prescription **cannot be forced through from the screen**. There is
no override path, by design: a clinician who judges the drug necessary despite
the conflict arranges it with the pharmacist directly.

### Where AI is used

Six features, all in the API, all role-gated, all landing in an editable field
that a human accepts or discards. Output renders in purple with a sparkle so a
suggestion is never confusable with a recorded fact. If a call fails, the
feature shows a plain message and the workflow continues manually — a clinical
action is never blocked on an AI response.

Autonomous clinical decision-making is excluded permanently, not pending.

---

## Assets

Fonts and icons are committed to `frontend/public/fonts` and served from this
origin. Nothing is fetched from Google at build time or at run time. Two v1.0
defects were caused by unreachable external assets in the deployed build, which
is why the design uses an icon font and initials tiles rather than photographs
in the first place. Material Symbols is subsetted to the 93 icons actually
used, 38 KB rather than the full 3 MB. The subset is generated from the code
by `frontend/scripts/build-icon-font.mjs`, and every screenshot run asserts
that no icon is rendering as text, because a missing glyph does not fall back
to a box: the ligature fails and the browser prints the name.

---

## Deploying

```bash
./deploy/aws/01-database.sh   # network, security groups, RDS, secrets
./deploy/aws/02-roles.sh      # the two App Runner roles
./deploy/aws/02-image.sh      # build for linux/amd64, push to ECR
./deploy/aws/03-seed.sh       # load the schema, then revoke its own access
./deploy/aws/04-service.sh    # VPC connector, App Runner service, health check
```

Each is idempotent: re-running finds what exists rather than failing. The
frontend deploys to Vercel from the repository with one environment variable,
`API_URL`.

Note what is *not* in that list: no key to paste anywhere. The database URL and
the token signing key live in Secrets Manager and are read by App Runner at
start-up; Bedrock is reached through the instance role. `API_URL` has no
`NEXT_PUBLIC_` prefix because every call the browser makes is relative to the
frontend, so the API's address never reaches the bundle.

`03-seed.sh` opens the database to the machine running it, loads the schema,
and then revokes that access and fails loudly if any address range remains.
After it runs, nothing on the internet can reach port 5432.
