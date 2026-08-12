"""Patient lookup and registration."""

from __future__ import annotations

import uuid
from typing import Any

import asyncpg

from ..serialise import row, rows

SEARCH = """
    select * from patients
     where ($1 = '' or full_name ilike '%'||$1||'%'
                    or mrn      ilike '%'||$1||'%'
                    or phone    ilike '%'||$1||'%')
     order by last_visit desc nulls last
     limit $2
"""


async def search(conn: asyncpg.Connection, query: str, limit: int = 50) -> list[dict]:
    return rows(await conn.fetch(SEARCH, query.strip(), limit))


async def get(conn: asyncpg.Connection, mrn: str) -> dict | None:
    return row(await conn.fetchrow("select * from patients where mrn = $1", mrn))


async def register(
    conn: asyncpg.Connection, actor: uuid.UUID, data: dict[str, Any]
) -> dict:
    record = await conn.fetchrow(
        """select * from register_patient($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
        actor,
        data["fullName"],
        data["age"],
        data["sex"],
        data["phone"],
        data.get("bloodGroup"),
        data.get("allergies") or [],
        data.get("conditions") or [],
        data.get("insurance"),
    )
    return row(record)  # type: ignore[return-value]
