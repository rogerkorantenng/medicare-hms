#!/usr/bin/env bash
# ================================================================
# Local verification harness — migration steps 1, 2 and 3
# ================================================================
# Rebuilds a throwaway Postgres database from the migration files and
# runs the acceptance checks that schema.sql, rls-policies.sql and
# seed.sql each specify at the bottom of the file.
#
# This proves the SQL before it is pasted into the Supabase SQL editor.
# It does NOT replace step 2's real acceptance test, which must be run
# against Supabase signed in as each role through the client, because
# only Supabase Auth issues the JWT.
#
#   ./supabase/verify/run.sh
#
set -euo pipefail

BASE=${HMS_PG_BASE:-/var/lib/postgresql/hms}
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PORT=${HMS_PG_PORT:-5433}
DB=hms
REPO="$(cd "$(dirname "${BASE_SOURCE:-$0}")/../.." && pwd)"

as_pg() { su postgres -c "$*"; }
psql_db() { as_pg "$PGBIN/psql -h $BASE/sock -p $PORT -U postgres -d $DB $*"; }

# Stand the cluster up if it is not already running. The container is
# ephemeral, so this script has to be able to start from nothing.
if ! as_pg "$PGBIN/pg_isready -h $BASE/sock -p $PORT -q"; then
  if [ ! -s "$BASE/data/PG_VERSION" ]; then
    echo "==> initialising a throwaway cluster in $BASE"
    rm -rf "$BASE/data" "$BASE/sock"
    mkdir -p "$BASE/data" "$BASE/sock"
    chown -R postgres:postgres "$BASE"
    as_pg "$PGBIN/initdb -D $BASE/data -U postgres --auth=trust -E UTF8" >/dev/null
  fi
  echo "==> starting postgres on port $PORT"
  mkdir -p "$BASE/sock"; chown postgres:postgres "$BASE/sock"
  as_pg "$PGBIN/pg_ctl -D $BASE/data -o '-k $BASE/sock -p $PORT -c listen_addresses=' -l $BASE/data/server.log start" >/dev/null
  for _ in $(seq 1 20); do as_pg "$PGBIN/pg_isready -h $BASE/sock -p $PORT -q" && break; sleep 0.5; done
fi

echo "==> resetting database"
as_pg "$PGBIN/psql -h $BASE/sock -p $PORT -U postgres -q -c 'drop database if exists $DB;' -c 'create database $DB;'"

# Stage the SQL where the postgres user can read it.
rm -rf "$BASE/sql"; mkdir -p "$BASE/sql"
cp "$REPO/supabase/migrations/"*.sql "$REPO/supabase/verify/"*.sql "$BASE/sql/"
chown -R postgres:postgres "$BASE/sql"

echo "==> 00 shim (local only, never run on Supabase)"
psql_db "-v ON_ERROR_STOP=1 -q -f $BASE/sql/00_supabase_shim.sql"

echo "==> 0001_schema.sql"
psql_db "-v ON_ERROR_STOP=1 -q -f $BASE/sql/0001_schema.sql"

echo "==> 0002_rls_policies.sql"
psql_db "-v ON_ERROR_STOP=1 -q -f $BASE/sql/0002_rls_policies.sql"

echo "==> auth users (Supabase Auth does this via scripts/create-users.mjs)"
psql_db "-v ON_ERROR_STOP=1 -q -f $BASE/sql/01_auth_users.sql"

echo "==> 0003_seed.sql"
psql_db "-v ON_ERROR_STOP=1 -q -f $BASE/sql/0003_seed.sql"

echo "==> 0004_functions.sql"
psql_db "-v ON_ERROR_STOP=1 -q -f $BASE/sql/0004_functions.sql"

echo
echo "==> step 1 acceptance: every constraint must reject"
psql_db "-v ON_ERROR_STOP=1 -q -f $BASE/sql/10_verify_schema.sql"

echo
echo "==> step 3 acceptance: seed counts and invoice totals"
psql_db "-v ON_ERROR_STOP=1 -q -f $BASE/sql/11_verify_seed.sql"

echo
echo "==> step 2 acceptance: row-level security per role"
psql_db "-v ON_ERROR_STOP=1 -q -f $BASE/sql/12_verify_rls.sql"

echo
echo "==> step 4 acceptance: application functions"
psql_db "-v ON_ERROR_STOP=1 -q -f $BASE/sql/13_verify_functions.sql"
