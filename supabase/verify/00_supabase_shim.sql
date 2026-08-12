-- ================================================================
-- LOCAL VERIFICATION SHIM — not part of the deployed migration set
-- ================================================================
-- Supabase provides auth.users, auth.uid() and the request.jwt.claims
-- setting. A bare Postgres does not. This file recreates just enough of
-- them to run the step 1 and step 2 acceptance checks locally, so the
-- constraints and policies are proven before anything is pasted into the
-- Supabase SQL editor.
--
-- Do NOT run this on Supabase. It is only for supabase/verify.

create extension if not exists pgcrypto;

create schema if not exists auth;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique not null,
  raw_app_meta_data  jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Supabase reads the subject claim out of the request JWT.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub', ''
  )::uuid;
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb);
$$;

-- The roles Supabase grants to API traffic.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to anon, authenticated, service_role;
grant select on auth.users   to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- Sign in as a role for the duration of a transaction. This is what the
-- Supabase client does per request: set the JWT claims, then run as the
-- `authenticated` database role so row-level security applies.
create or replace function verify_sign_in(p_uid uuid, p_role text)
returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_uid::text,
      'role', 'authenticated',
      'app_metadata', jsonb_build_object('role', p_role)
    )::text,
    true      -- transaction-local
  );
end $$;

-- Sign out: clear the claims.
create or replace function verify_sign_out() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
end $$;
