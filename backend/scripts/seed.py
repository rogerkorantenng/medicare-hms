"""
Build the database from nothing: schema, functions, accounts, seed data.

    uv run python scripts/seed.py            # local, from backend/.env
    uv run python scripts/seed.py --reset    # drop everything first

Safe to re-run with --reset. Without it, an already-populated database
is left alone rather than half-seeded.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

import asyncpg

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from accounts import ACCOUNTS, ROSTER_DOCTORS  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.security import hash_password  # noqa: E402

SQL_DIR = Path(__file__).resolve().parents[1] / "sql"


async def run_file(conn: asyncpg.Connection, name: str) -> None:
    print(f"  {name}")
    await conn.execute((SQL_DIR / name).read_text())


async def create_accounts(conn: asyncpg.Connection, password: str) -> None:
    digest = hash_password(password)
    for email, role in ACCOUNTS:
        await conn.execute(
            """insert into users (email, password_hash, role) values ($1, $2, $3::role_enum)
               on conflict (email) do update set password_hash = excluded.password_hash""",
            email, digest, role,
        )
    for email in ROSTER_DOCTORS:
        await conn.execute(
            """insert into users (email, password_hash, role) values ($1, null, 'doctor')
               on conflict (email) do nothing""",
            email,
        )
    print(f"  {len(ACCOUNTS)} sign-in accounts, {len(ROSTER_DOCTORS)} roster doctors")


def read_password() -> str | None:
    password = os.environ.get("DEMO_PASSWORD")
    if not password:
        print("Set DEMO_PASSWORD. It becomes the examiner password in Links.txt.")
        return None
    if len(password) < 12:
        print("DEMO_PASSWORD is short. Use at least 12 characters — this account is public.")
        return None
    return password


async def main(reset: bool) -> int:
    password = read_password()
    if password is None:
        return 1

    conn = await asyncpg.connect(get_settings().database_url)
    try:
        if reset:
            print("Dropping and recreating the public schema")
            await conn.execute("drop schema public cascade; create schema public;")
        elif await conn.fetchval("select to_regclass('public.patients') is not null"):
            print("Database already has tables. Use --reset to rebuild it.")
            return 1

        print("Applying schema")
        await run_file(conn, "001_schema.sql")
        await run_file(conn, "002_functions.sql")
        print("Creating accounts")
        await create_accounts(conn, password)
        print("Seeding")
        await run_file(conn, "003_seed.sql")
        # A hospital mid-morning rather than one that has just opened: a
        # queue, vitals half taken, consultations already on the charts.
        # Without it the receptionist, nurse and doctor dashboards are
        # empty, which is three of the nine.
        await run_file(conn, "004_seed_activity.sql")

        counts = await conn.fetchrow(
            """select (select count(*) from patients) as patients,
                      (select count(*) from staff) as staff,
                      (select count(*) from ward_beds) as beds,
                      (select count(*) from appointments
                        where status = 'checked_in'
                          and appt_date = current_date) as queue,
                      (select count(*) from encounters) as encounters"""
        )
        print(f"\nDone. {counts['patients']} patients, {counts['staff']} staff, "
              f"{counts['beds']} beds, {counts['queue']} in the queue, "
              f"{counts['encounters']} consultations on record.")
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="drop the schema first")
    raise SystemExit(asyncio.run(main(parser.parse_args().reset)))
