from __future__ import annotations

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import asyncpg
from fastapi import HTTPException

from .config import get_settings

_pool: asyncpg.Pool | None = None


async def init_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=settings.db_pool_min,
            max_size=settings.db_pool_max,
            # The schema uses jsonb in and out of several functions;
            # decode it to Python rather than handing back strings.
            init=_register_codecs,
        )
    return _pool


async def _register_codecs(conn: asyncpg.Connection) -> None:
    await conn.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
    )
    await conn.set_type_codec(
        "json", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
    )


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool is not initialised.")
    return _pool


@asynccontextmanager
async def connection() -> AsyncIterator[asyncpg.Connection]:
    async with pool().acquire() as conn:
        yield conn


@asynccontextmanager
async def transaction() -> AsyncIterator[asyncpg.Connection]:
    async with pool().acquire() as conn:
        async with conn.transaction():
            yield conn


# ---------------------------------------------------------------------
# Turning Postgres errors into something a clinician can act on.
# ---------------------------------------------------------------------
# The constraints are the point of this schema, so when one fires the
# message the user sees should explain the rule, not name the index.

_CONSTRAINT_MESSAGES: dict[str, str] = {
    "encounters_diagnosis_check": "A diagnosis is required to sign a consultation.",
    "appt_no_double_booking": "That slot has just been taken. Choose another time.",
    "bed_one_patient_only": "That patient already occupies a bed.",
    "inventory_items_quantity_check": "There is not enough stock to dispense that quantity.",
    "patients_age_check": "That age is outside the range the record allows.",
    "patients_sex_check": "Sex must be recorded as M or F.",
    "prescriptions_quantity_check": "The quantity must be at least one.",
    "invoices_paid_check": "A payment cannot be negative.",
}

_VITALS_RANGES = {
    "vitals_systolic_check": "Systolic pressure must be between 50 and 300 mmHg.",
    "vitals_diastolic_check": "Diastolic pressure must be between 30 and 200 mmHg.",
    "vitals_temperature_check": "Temperature must be between 30 and 45 °C.",
    "vitals_pulse_check": "Pulse must be between 20 and 250 bpm.",
    "vitals_spo2_check": "Oxygen saturation must be between 50 and 100%.",
    "vitals_weight_kg_check": "Weight must be between 1 and 400 kg.",
}


def humanise(exc: Exception) -> tuple[int, str]:
    """Map a database error to an HTTP status and a plain message."""
    if isinstance(exc, asyncpg.exceptions.PostgresError):
        constraint = getattr(exc, "constraint_name", None) or ""
        if constraint in _CONSTRAINT_MESSAGES:
            return 409, _CONSTRAINT_MESSAGES[constraint]
        if constraint in _VITALS_RANGES:
            return 422, _VITALS_RANGES[constraint]

        message = str(exc)
        # raise exception in plpgsql arrives as RaiseError; those messages
        # were written for the user already.
        if isinstance(exc, asyncpg.exceptions.RaiseError):
            return 409, message
        if isinstance(exc, asyncpg.exceptions.UniqueViolationError):
            return 409, "That already exists."
        if isinstance(exc, asyncpg.exceptions.ForeignKeyViolationError):
            return 409, "That refers to a record which does not exist."
        if isinstance(exc, asyncpg.exceptions.CheckViolationError):
            return 422, "One of those values is outside the range allowed."
        if isinstance(exc, asyncpg.exceptions.GeneratedAlwaysError):
            return 409, "That column is derived and cannot be written to."

    return 500, "Something went wrong."


def as_http(exc: Exception) -> HTTPException:
    status, message = humanise(exc)
    return HTTPException(status_code=status, detail=message)


def rows_to_dicts(rows: list[asyncpg.Record]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]
