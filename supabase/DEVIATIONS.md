# Deviations from the handoff package

The handoff README is explicit:

> Do not invent a different schema. [...] If you believe something in the
> schema is wrong, flag it rather than silently changing it, because the
> documentation would then need updating too.

So nothing here was changed quietly. Four defects were found by running the
handoff's own acceptance checks against PostgreSQL before anything touched
the live project. All four stopped the system working; none of them is a
matter of taste.

The entity model is untouched: still 16 tables, same keys, same constraints,
same policy model. **No submitted document needs amending for any of these.**
Three are bugs in SQL that could not execute, and the fourth is a function
volatility setting that no document mentions.

Verify any of this with:

```bash
./supabase/verify/run.sh
```

which rebuilds a throwaway database from the migrations and runs the
acceptance blocks from the bottom of `schema.sql`, `seed.sql` and
`rls-policies.sql`.

---

## 1. `seed.sql` — roster doctors violated the staff foreign key

**Severity: seed could not load.**

`schema.sql` declares:

```sql
create table staff (
  id uuid primary key references auth.users(id) on delete cascade,
  ...
```

so every staff row must correspond to an auth user. But `seed.sql` inserted
the three roster doctors with generated ids:

```sql
insert into staff (id, staff_no, full_name, role, department, on_duty) values
  (gen_random_uuid(), 'ST-009','Dr. Emily Parker', 'doctor','Neurology', true),
```

```
ERROR:  insert or update on table "staff" violates foreign key constraint "staff_id_fkey"
DETAIL:  Key (id)=(68eb5327-...) is not present in table "users".
```

The two files contradicted each other. **Resolved in favour of the schema**,
because the schema is what the submitted entity relationship diagram
describes, and relaxing the foreign key would have put the code out of step
with six documents.

The three roster doctors now get auth users created **without a password** by
`scripts/create-users.mjs`. They remain schedulable staff that nobody can
sign in as, which is what the handoff's own comment — "These have no login;
they exist as schedulable staff" — intended.

## 2. `seed.sql` — malformed multidimensional array

**Severity: seed could not load.**

The 22-patient generator declared:

```sql
conds text[][] := array[array[]::text[], array['Hypertension'], ...];
```

```
ERROR:  multidimensional arrays must have array expressions with matching dimensions
```

Postgres will not build a 2-D array from a mix of empty and one-element
arrays. Held as a flat list of eight condition slots instead, empty string
meaning no condition, expanded at the point of use. **The data produced is
identical to what the handoff intended.**

## 3. `rls-policies.sql` — infinite recursion in every policy helper

**Severity: critical. Every authenticated query against every table failed.**

This is the one that mattered most, and it would have failed on Supabase in
exactly the same way it failed locally.

```
ERROR:  stack depth limit exceeded
CONTEXT:  SQL function "jwt_role" during inlining
          SQL function "is_staff" during inlining
          SQL function "jwt_role" during startup      (repeated to the stack limit)
```

The four helpers shipped as plain SQL functions. Postgres **inlines** plain
SQL functions. `jwt_role()` falls back to `select role from staff where id =
auth.uid()`. Planning that subquery applies `staff`'s own policy, which calls
`is_staff()`, which calls `jwt_role()`, which plans the same subquery again,
without bound.

The `coalesce` does not rescue it. COALESCE short-circuits at **execution**,
but the planner must still **plan** the second branch, and it is the planning
that recurses. So the claim being present in the JWT makes no difference.
Every policy on every table calls one of these helpers, so nothing worked.

**Fix:** `security definer` with a pinned `search_path` — the pattern
Supabase documents for this exact problem. It breaks the cycle twice over: a
`security definer` function is never inlined, and the `staff` lookup runs as
the function owner, so it never re-enters row-level security.

Nothing about the authorisation **model** changes. Same roles, same reads,
same refusals — as the 20 passing checks in `12_verify_rls.sql` show.
`my_mrn()` still returns only the caller's own MRN because it is keyed on
`auth.uid()`.

## 4. `schema.sql` — result release could never fire

**Severity: critical. The system's most important clinical rule was inert.**

`release_verified_result()` inserts into `notifications`. But
`rls-policies.sql` enables row-level security on `notifications` and grants a
select policy and an update policy — and **no insert policy, to anybody**.

So the technician doing the verifying could not write the notification that
the release depends on:

```
ERROR:  new row violates row-level security policy for table "notifications"
```

Verifying any laboratory result failed outright, which means this rule from
the handoff's own non-negotiable list could never be satisfied:

| Rule | Where it must be enforced |
|---|---|
| A laboratory result reaches nobody until it is verified | Database: release fires on the verify transition only |
| A verified result flagged critical alerts the ordering doctor | Application, as a banner |

**Fix:** `security definer` on the trigger function. This follows the pattern
the handoff already uses and states explicitly for invoice lines — "Lines are
written by the `add_invoice_line` function, which is security definer, so no
direct insert policy is granted." `write_audit()` and `add_invoice_line()`
are `security definer` for precisely this reason. This trigger was the one
that got missed.

---

## Not changed, though it reads oddly

`schema.sql`'s verification note 3 is labelled "Two patients in one bed", but
the index it refers to —

```sql
create unique index bed_one_patient_only on ward_beds (mrn) where mrn is not null;
```

— enforces the opposite: **one patient cannot occupy two beds**. One bed
holding at most one patient is already guaranteed by `ward_beds` having a
single `mrn` column keyed on `(ward, bed_no)`.

Both rules therefore hold, which is what the non-negotiable list requires.
Only the comment's wording is inverted, so the SQL is left exactly as
submitted and the test asserts the real behaviour.

## A note on what local verification does and does not prove

`./supabase/verify/run.sh` proves the constraints, the triggers, the derived
columns and the policy logic. It stands up a small shim for `auth.users`,
`auth.uid()` and the `request.jwt.claims` setting, and it runs the checks as
the `authenticated` database role — never as the table owner or a superuser,
either of which bypasses row-level security and would give a false pass.

It does **not** replace step 2's real acceptance test. That has to be run
against Supabase, signed in as each role through the client, because only
Supabase Auth issues a real JWT. `deployment.md` is right to insist on it,
and right to warn against using the service-role key for it.
