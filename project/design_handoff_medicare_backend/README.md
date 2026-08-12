# Handoff: MediCare+ HMS — Supabase backend and Vercel deployment

## Overview

MediCare+ is a hospital management system covering the full patient journey across
nine roles: registration, appointments, nurse triage, consultation, laboratory and
imaging orders, pharmacy dispensing, ward and bed management, billing, insurance
claims, and administration. It also includes a patient-facing mobile application.

**Version 1.0 is built and working**, with all screens, all business rules and all
six AI features implemented. It persists to browser storage.

**This handoff covers one job:** replace browser storage with a real PostgreSQL
database on Supabase, move authorisation into the database, and deploy on Vercel.

This is deliberately NOT a rewrite. The v1.0 architecture put the persistence
interface behind a boundary owned by the domain layer, precisely so this swap
would touch one construction point rather than every screen.

---

## CRITICAL: follow the submitted design, do not improvise

This project has **six submitted academic documents** that describe the system's
architecture, data model and migration plan in detail. An examiner will
cross-check the code against them.

**Do not invent a different schema.** The 16 entities, their keys, and their
constraints are specified in `schema.sql` and were taken directly from the
submitted entity relationship diagram. If you believe something in the schema is
wrong, flag it rather than silently changing it, because the documentation would
then need updating too.

The submitted six-step migration plan, which this handoff implements:

| Step | Work | Acceptance criterion |
|---|---|---|
| 1 | Create the schema with its constraints | Seed data loads; every constraint rejects the case it exists to reject |
| 2 | Move authorisation into the database | Security cases TC-95 to TC-99 pass against the database directly, not through the interface |
| 3 | Write the server adapter | Existing integration behaviour unchanged |
| 4 | Switch the adapter | Full journey works with data shared across two devices |
| 5 | Move AI calls server-side | No API key appears in any client request |
| 6 | Backup and restore | A restore has actually been performed onto a fresh instance |

---

## About the design files

The files in `design_reference/` are **design references created as HTML
prototypes**. They show the intended look, behaviour and business rules. They are
not production code to copy line by line.

`MediCare HMS.dc.html` is the staff workspace, all eight staff roles plus the
patient portal. `MediCare Mobile.dc.html` is the patient mobile application.
Both are single-file component-based HTML applications. They run by opening them
in a browser.

**Your task is to recreate these in Next.js** (App Router, TypeScript, React)
backed by Supabase, preserving the visual design and every business rule exactly.
The HTML is the specification for both.

## Fidelity

**High fidelity.** These are pixel-complete designs with final colours,
typography, spacing, states and copy. Recreate the UI faithfully. Design tokens
are listed in `design-tokens.md`. Do not substitute a component library's
default styling.

---

## Target stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14+, App Router, TypeScript | Server components where possible |
| Database | Supabase PostgreSQL | Schema in `schema.sql` |
| Auth | Supabase Auth, email and password | Nine role accounts; role in JWT claims |
| Authorisation | PostgreSQL row-level security | Policies in `rls-policies.sql` — this is step 2 and the most important part |
| Styling | Tailwind CSS | Tokens in `design-tokens.md` |
| AI | Anthropic API via Next.js route handlers | Server-side only; key never reaches the client |
| Hosting | Vercel | Steps in `deployment.md` |

---

## Build order

Do these in order. Steps 1 and 2 must be complete and verified before any UI work,
because the UI is already designed and the database is where the risk is.

1. **Schema.** Run `schema.sql` in the Supabase SQL editor. Verify every
   constraint by trying to violate it. The checks are listed at the bottom of the
   file.
2. **Authorisation.** Run `rls-policies.sql`. Then run the verification queries
   at the bottom of that file. A cashier querying a clinical table must return
   zero rows. Do not proceed until this passes.
3. **Seed.** Run `seed.sql`. This creates the nine role accounts and the 28
   synthetic patients the examiner will see.
4. **Repository layer.** Implement the interface in `repository-contract.md`.
   This is the single boundary the UI talks to.
5. **AI routes.** Create the six route handlers in `ai-routes.md`.
6. **UI.** Recreate the screens from the HTML references, screen by screen, using
   the repository layer. Screen inventory is in `screen-inventory.md`.
7. **Deploy.** Follow `deployment.md`.

---

## Non-negotiable business rules

These came from observing a real hospital and they are the reason the system
exists. Several are enforced in the database, not only in the UI. Do not relax any
of them for convenience.

| Rule | Where it must be enforced |
|---|---|
| A drug matching a recorded patient allergy cannot be prescribed | Application, blocking, with the allergy named |
| A new prescription conflicting with an active drug raises a warning | Application, blocking, with the interaction named |
| Allergy and interaction checks are deterministic, never AI | Application. Same input must always give the same result. |
| A laboratory result reaches nobody until it is verified | Database: release fires on the verify transition only |
| A verified result flagged critical alerts the ordering doctor | Application, as a banner, not a passive list entry |
| Order status moves forward one stage at a time, never skipping | Database trigger, see `schema.sql` |
| One bed holds at most one patient | Database: unique partial index |
| A consultation cannot be signed without a diagnosis | Application validation |
| Invoice status is derived from total and paid, never stored | Database: generated column |
| Every state change is attributable to a named user | Database: audit table, append-only, no update or delete grant |
| Non-clinical roles cannot read clinical tables | Database: row-level security |
| A patient sees only their own record | Database: row-level security |
| Every AI output requires a human to accept it before it enters the record | Application |
| AI service failure never blocks a clinical workflow | Application: message shown, manual path continues |
| All money is Ghana Cedis | Application formatting, `GH₵` |

---

## Files in this handoff

| File | Contents |
|---|---|
| `README.md` | This document |
| `schema.sql` | All 16 tables, constraints, indexes, triggers |
| `rls-policies.sql` | Row-level security per role, plus verification queries |
| `seed.sql` | Nine role accounts, 28 patients, wards, catalogue, inventory, open work |
| `repository-contract.md` | The single interface the UI talks to |
| `ai-routes.md` | Six server route handlers with their system prompts |
| `screen-inventory.md` | Every screen, its role, and its purpose |
| `design-tokens.md` | Colours, type scale, spacing, radius, iconography |
| `deployment.md` | Supabase and Vercel setup, environment variables, examiner credentials |
| `design_reference/` | The working v1.0 HTML applications |

## Assets

No image assets. Avatars are initials tiles generated from the person's name.
Icons are Material Symbols Rounded, loaded as a font. Typefaces are Plus Jakarta
Sans, Inter and JetBrains Mono from Google Fonts. This was a deliberate decision
after two defects were caused by unreachable external images in a deployed build.
