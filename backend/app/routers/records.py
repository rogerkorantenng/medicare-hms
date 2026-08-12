"""
Filing documents, tracking a scan, transferring a bed, and re-triaging.

Four gaps that shared a shape: the schema already allowed the thing and
no code could reach it. `documents` was only ever written by
discharge_patient, so a referral letter or a consent form had nowhere to
go. `imaging_status` had four states and the code jumped from the first
to the last, leaving scan tracking unimplemented while the submitted
documents described it.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import connection
from ..security import CLINICAL_ROLES, CurrentUser, require, scope_to_patient
from ..serialise import row

router = APIRouter(tags=["records"])

Clinical = Annotated[CurrentUser, Depends(require(*CLINICAL_ROLES, "receptionist"))]
Radiology = Annotated[CurrentUser, Depends(require("radiology", "admin"))]
Nurse = Annotated[CurrentUser, Depends(require("nurse", "doctor", "admin"))]

KINDS = {"referral", "consent", "report", "letter", "discharge", "other"}


class NewDocument(BaseModel):
    mrn: str
    title: str = Field(min_length=2, max_length=160)
    kind: str = "other"
    body: str = Field(min_length=1, max_length=20000)


class Transfer(BaseModel):
    mrn: str
    ward: str
    bedNo: str


class Acuity(BaseModel):
    acuity: str
    reason: str = Field(min_length=3, max_length=200)


@router.post("/documents", status_code=201)
async def file_document(body: NewDocument, user: Clinical):
    """
    Typed in rather than uploaded. There is no file storage in this
    deployment, and a fake upload button that silently discarded a scan
    would be worse than a text field that keeps what it is given.
    """
    if body.kind not in KINDS:
        raise HTTPException(status_code=422,
                            detail=f"Kind must be one of {', '.join(sorted(KINDS))}.")
    async with connection() as conn:
        async with conn.transaction():
            known = await conn.fetchval("select 1 from patients where mrn = $1", body.mrn)
            if not known:
                raise HTTPException(status_code=404, detail="No patient with that MRN.")
            record = await conn.fetchrow(
                """insert into documents (mrn, title, kind, body, created_by)
                   values ($1, $2, $3, $4, $5) returning *""",
                body.mrn, body.title.strip(), body.kind, body.body, user.id)
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"Filed a {body.kind}: {body.title}", body.mrn)
    return row(record)


@router.post("/imaging/{order_id}/advance", status_code=204)
async def advance_imaging(order_id: int, user: Radiology, next: str):
    """
    ordered to scheduled to scanned, one step at a time. Reporting stays
    on its own route, because filing findings is a different act from
    moving a patient through the department.
    """
    allowed = {"scheduled": "ordered", "scanned": "scheduled"}
    if next not in allowed:
        raise HTTPException(status_code=422,
                            detail="A scan moves to scheduled, then scanned.")
    async with connection() as conn:
        async with conn.transaction():
            order = await conn.fetchrow(
                """update imaging_orders set status = $2::imaging_status
                    where id = $1 and status = $3::imaging_status
                    returning mrn, modality""",
                order_id, next, allowed[next])
            if order is None:
                raise HTTPException(
                    status_code=409,
                    detail=f"That study is not {allowed[next]}, so it cannot be {next}.")
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"{order['modality']} {next}", order["mrn"])


@router.post("/wards/transfer", status_code=204)
async def transfer(body: Transfer, user: Nurse):
    """Freeing the old bed and taking the new one is a single transaction."""
    async with connection() as conn:
        await conn.execute("select transfer_bed($1, $2, $3, $4)",
                           user.id, body.mrn, body.ward, body.bedNo)


@router.post("/queue/{mrn}/acuity", status_code=204)
async def reprioritise(mrn: str, body: Acuity, user: Nurse):
    """
    A patient who deteriorates in the waiting room has to be able to move
    up the queue. The change is written against the latest reading, and
    audited, because moving somebody up moves everyone else down.
    """
    if body.acuity not in {"routine", "semi_urgent", "urgent"}:
        raise HTTPException(status_code=422, detail="Unknown acuity.")
    async with connection() as conn:
        async with conn.transaction():
            scope_to_patient(user, mrn)
            updated = await conn.fetchval(
                """update vitals set acuity = $2::acuity_enum
                    where id = (select id from vitals where mrn = $1
                                 and superseded_by is null
                                 order by recorded_at desc limit 1)
                    returning id""", mrn, body.acuity)
            if updated is None:
                raise HTTPException(
                    status_code=409,
                    detail="No vitals recorded yet, so there is no triage to change.")
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"Re-triaged to {body.acuity} ({body.reason})", mrn)
