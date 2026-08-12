"""
Correcting the clinical record without rewriting it.

A signed consultation is not editable, and should not be. An addendum is
how a correction is made in a real record: the original stays, the
correction is dated and attributed, and a reader sees both.

Vitals work the same way. A systolic typed as 1680 is superseded rather
than overwritten, because somebody may have acted on the wrong number
and the trail has to show that they could have.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import connection
from ..security import CLINICAL_ROLES, CurrentUser, require
from ..serialise import row

router = APIRouter(tags=["clinical"])

Doctor = Annotated[CurrentUser, Depends(require("doctor", "admin"))]
Clinical = Annotated[CurrentUser, Depends(require(*CLINICAL_ROLES))]


class Addendum(BaseModel):
    body: str = Field(min_length=5, max_length=4000)


class Correction(BaseModel):
    note: str = Field(min_length=3, max_length=200)
    systolic: int | None = None
    diastolic: int | None = None
    temperature: float | None = None
    pulse: int | None = None
    spo2: int | None = None
    weightKg: float | None = None


class Reason(BaseModel):
    reason: str = Field(min_length=3, max_length=200)


@router.post("/encounters/{encounter_id}/addendum", status_code=201)
async def add_addendum(encounter_id: int, body: Addendum, user: Doctor):
    async with connection() as conn:
        async with conn.transaction():
            owner = await conn.fetchval(
                "select mrn from encounters where id = $1", encounter_id)
            if owner is None:
                raise HTTPException(status_code=404, detail="No such consultation.")
            record = await conn.fetchrow(
                """insert into encounter_addenda (encounter_id, body, author_id)
                   values ($1, $2, $3) returning *""",
                encounter_id, body.body.strip(), user.id)
            await conn.execute("select write_audit($1, 'Added an addendum', $2)",
                               user.id, owner)
    return row(record)


@router.post("/vitals/{vitals_id}/correct", status_code=201)
async def correct_vitals(vitals_id: int, body: Correction, user: Clinical):
    """
    Writes a new reading that supersedes the old one. The original is
    kept: somebody may have acted on the wrong number, and a record that
    hides that is not a record.
    """
    async with connection() as conn:
        async with conn.transaction():
            original = await conn.fetchrow(
                "select * from vitals where id = $1 and superseded_by is null", vitals_id)
            if original is None:
                raise HTTPException(
                    status_code=404,
                    detail="No such reading, or it has already been corrected.")

            fields = body.model_dump(exclude_none=True)
            fields.pop("note", None)
            merged = {k: fields.get(k, original[c]) for k, c in (
                ("systolic", "systolic"), ("diastolic", "diastolic"),
                ("temperature", "temperature"), ("pulse", "pulse"),
                ("spo2", "spo2"), ("weightKg", "weight_kg"))}

            replacement = await conn.fetchrow(
                """insert into vitals (mrn, recorded_by, systolic, diastolic, temperature,
                                       pulse, spo2, weight_kg, acuity, correction_note)
                   values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *""",
                original["mrn"], user.id, merged["systolic"], merged["diastolic"],
                merged["temperature"], merged["pulse"], merged["spo2"],
                merged["weightKg"], original["acuity"], body.note)

            await conn.execute("update vitals set superseded_by = $2 where id = $1",
                               vitals_id, replacement["id"])
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"Corrected vitals ({body.note})", original["mrn"])
    return row(replacement)


@router.post("/lab/{order_id}/cancel", status_code=204)
async def cancel_lab(order_id: int, body: Reason, user: Clinical):
    async with connection() as conn:
        async with conn.transaction():
            owner = await conn.fetchrow(
                """update lab_orders set cancelled_reason = $2
                    where id = $1 and status <> 'verified' returning mrn, test_name""",
                order_id, body.reason)
            if owner is None:
                raise HTTPException(
                    status_code=409, detail="That order is verified and cannot be cancelled.")
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"Cancelled {owner['test_name']} ({body.reason})", owner["mrn"])


@router.post("/lab/{order_id}/reject", status_code=204)
async def reject_sample(order_id: int, body: Reason, user: Clinical):
    """
    A haemolysed or mislabelled sample is a laboratory outcome, not an
    error. The order returns to 'ordered' so a fresh sample can be taken.
    """
    async with connection() as conn:
        async with conn.transaction():
            owner = await conn.fetchrow(
                """update lab_orders
                      set rejected_reason = $2, status = 'ordered'
                    where id = $1 and status in ('collected', 'processing')
                    returning mrn, test_name""",
                order_id, body.reason)
            if owner is None:
                raise HTTPException(
                    status_code=409,
                    detail="Only a collected or processing sample can be rejected.")
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"Rejected sample for {owner['test_name']} ({body.reason})",
                               owner["mrn"])
