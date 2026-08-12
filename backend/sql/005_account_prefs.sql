-- ---------------------------------------------------------------------
-- Notification preferences, and password reset requests.
--
-- Written as an additive migration rather than an edit to 001_schema.sql
-- so it can be applied to a running database without dropping anything.
-- Both statements are safe to run twice.
-- ---------------------------------------------------------------------

-- ---------- notification preferences ----------
-- The patient app has always shown three switches. They were decoration:
-- hardcoded to on, with nowhere to save an answer. This gives them one.
--
-- A column rather than a table, because a preference set has exactly one
-- owner and is never queried on its own.

alter table users
  add column if not exists notify_prefs jsonb not null
    default '{"results": true, "appointments": true, "billing": true}'::jsonb;

-- ---------- password reset requests ----------
-- There is no outbound email in this system, and pretending otherwise
-- would be worse than not having the feature: a patient would wait for a
-- message that never arrives.
--
-- So "forgot password" raises a request that reception can see and act on
-- at the desk, against photo identification, which is how a hospital
-- verifies somebody in person anyway. The request stores no token and
-- grants nothing by itself.

create table if not exists password_reset_requests (
  id           bigserial primary key,
  email        text not null,
  -- Null when the address matches no account. The row is still written,
  -- so the response to the patient can be identical either way and the
  -- form cannot be used to discover which addresses are registered.
  user_id      uuid references users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  handled_by   uuid references staff(id),
  handled_at   timestamptz
);

create index if not exists password_reset_open
  on password_reset_requests (requested_at desc)
  where handled_at is null;
