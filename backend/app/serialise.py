"""
Postgres speaks snake_case; the frontend's Repository types speak
camelCase. Converting here means the TypeScript interface from the
original design handoff carries over unchanged, which is the whole
point of that contract.

Also flattens the joined names asyncpg returns, and renders numerics as
floats rather than Decimal so they survive JSON.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import Any

import asyncpg


def to_camel(key: str) -> str:
    head, *rest = key.split("_")
    return head + "".join(word.capitalize() for word in rest)


def _value(v: Any) -> Any:
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, dt.time):
        return v.strftime("%H:%M")
    if isinstance(v, (dt.datetime, dt.date)):
        return v.isoformat()
    return v


def row(record: asyncpg.Record | dict | None, **extra: Any) -> dict[str, Any] | None:
    """One record, camelCased. `extra` is merged in already-camelCased."""
    if record is None:
        return None
    out = {to_camel(k): _value(v) for k, v in dict(record).items()}
    out.update(extra)
    return out


def rows(records: list[asyncpg.Record]) -> list[dict[str, Any]]:
    return [row(r) for r in records]  # type: ignore[misc]
