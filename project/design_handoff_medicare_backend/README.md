# Design handoff: MediCare+ HMS

This folder is the design authority for the system. Three of its documents are
still cited by the code that implements them:

| Document | Cited by |
|---|---|
| `repository-contract.md` | `frontend/lib/repository/types.ts`, the interface every screen talks to |
| `ai-routes.md` | `backend/app/prompts.py`, which carries the six system prompts verbatim |
| `design-tokens.md` | `frontend/tailwind.config.ts`, where every colour and size comes from |
| `screen-inventory.md` | The screen list the six submitted documents describe |

`design_reference/` holds the v1.0 prototypes the design was extracted from.

---

## What this handoff originally asked for, and what was built

The brief was to replace browser storage with PostgreSQL on Supabase,
move authorisation into the database with row-level security, and deploy
the whole thing on Vercel.

Two of those three were carried out differently, and the reasoning is set out
in full in Design Documentation §9.3 and §9.4. In short:

| Asked for | Delivered | Why |
|---|---|---|
| PostgreSQL on Supabase | PostgreSQL on Amazon RDS, behind a FastAPI service on App Runner | The system needed a backend it controlled, not only a database with an API in front of it |
| Row-level security | Guards on every API route | Both were built and both worked. Once every client arrives through one API, an authorisation model that protects only direct database connections protects nothing that exists |
| Everything on Vercel | Next.js on Vercel, API and database on AWS | The interface is the only part the browser reaches |

The parts of the brief that did carry over unchanged are the ones that mattered
most: the 16-entity schema with its constraints, the repository interface, the
six AI prompts, and the design tokens. The schema now lives in
[`backend/sql/001_schema.sql`](../../backend/sql/001_schema.sql) and the seed in
`003_seed.sql`, both plain PostgreSQL.

The one claim in the original brief that held exactly as written: the swap
touched one construction point rather than every screen. That line is
`frontend/lib/repository/index.ts`, and it is still one line.

---

## Running it locally

No hosted service is needed. The whole system runs on a laptop:

```bash
docker compose up --build       # database, API and frontend
docker compose run --rm seed    # schema, functions, accounts, seed data
```

Then <http://localhost:3000>. If those ports are taken:

```bash
API_PORT=8010 WEB_PORT=3010 docker compose up
```

The database image matches the RDS engine version and the API image is the one
App Runner runs, so nothing behaves differently between a laptop and AWS.

Sign in with any of the nine role accounts. The password is the `DEMO_PASSWORD`
the seed was run with; the accounts themselves are in
[`backend/scripts/accounts.py`](../../backend/scripts/accounts.py).

To run the parts separately, and for the verification suites, see the
[root README](../../README.md).

---

## The six-step migration plan, and how it went

The plan came from the submitted documents, so it is recorded here with the
outcome against each step rather than quietly replaced.

| Step | Work | Outcome |
|---|---|---|
| 1 | Create the schema with its constraints | Met. Nine constraints, each rejecting the case it exists to reject |
| 2 | Move authorisation into the database | Met, then deliberately changed. See §9.4 of the Design Documentation |
| 3 | Write the server adapter | Met. `HttpRepository` satisfies the same interface |
| 4 | Switch the adapter at its single construction point | Met. One line, and no screen changed |
| 5 | Move AI calls server-side so no key reaches a browser | Exceeded. There is no key at all; Bedrock is reached through an IAM role |
| 6 | Backup and restore | Partly met. Backups and point-in-time recovery are configured; the acceptance criterion is a restore actually performed, and that has not been done |
