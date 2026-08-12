"""
Correcting a patient record.

A registration typo used to be permanent: there was no way to fix a
misspelled name or a wrong phone number, and no way to record an allergy
discovered after registration. The last of those matters most, because the
prescribing safety rules read the allergy list. A patient who tells a nurse
at triage that penicillin brings them out in a rash is not protected by
anything until that reaches the record.

Who may change what is split deliberately. Reception owns the demographics
they captured; clinical staff own the clinical facts. Nobody owns the MRN,
which is why it does not appear here at all.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import connection
from ..security import CurrentUser, require
from ..serialise import row

router = APIRouter(prefix="/patients", tags=["patients"])

Desk = Annotated[CurrentUser, Depends(require("receptionist", "admin"))]
Clinical = Annotated[CurrentUser, Depends(
    require("doctor", "nurse", "receptionist", "admin"))]


class Demographics(BaseModel):
    fullName: str | None = Field(default=None, min_length=2, max_length=120)
    age: int | None = Field(default=None, ge=0, le=130)
    phone: str | None = Field(default=None, min_length=6, max_length=40)
    bloodGroup: str | None = None
    insurance: str | None = None


class ClinicalFacts(BaseModel):
    allergies: list[str] | None = None
    conditions: list[str] | None = None


def _clean(values: list[str] | None) -> list[str] | None:
    """Trim, drop blanks, and keep the order somebody typed them in."""
    if values is None:
        return None
    seen: list[str] = []
    for value in values:
        text = value.strip()
        if text and text not in seen:
            seen.append(text)
    return seen


@router.patch("/{mrn}", status_code=200)
async def correct_demographics(mrn: str, body: Demographics, user: Desk):
    """Reception corrects what reception captured."""
    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nothing to change.")

    columns = {"fullName": "full_name", "age": "age", "phone": "phone",
               "bloodGroup": "blood_group", "insurance": "insurance"}
    assignments = ", ".join(
        f"{columns[key]} = ${i + 2}" for i, key in enumerate(fields))
    values = list(fields.values())

    async with connection() as conn:
        async with conn.transaction():
            record = await conn.fetchrow(
                f"update patients set {assignments} where mrn = $1 returning *",
                mrn, *values)
            if record is None:
                raise HTTPException(status_code=404, detail="No patient with that MRN.")
            await conn.execute(
                "select write_audit($1, $2, $3)", user.id,
                f"Corrected patient details ({', '.join(fields)})", mrn)
    return row(record)


@router.patch("/{mrn}/clinical", status_code=200)
async def update_clinical_facts(mrn: str, body: ClinicalFacts, user: Clinical):
    """
    Allergies and chronic conditions.

    Recording an allergy here is what makes the prescribing guard fire for
    it, so this is a clinical action and is audited as one.
    """
    allergies, conditions = _clean(body.allergies), _clean(body.conditions)
    if allergies is None and conditions is None:
        raise HTTPException(status_code=422, detail="Nothing to change.")

    async with connection() as conn:
        async with conn.transaction():
            record = await conn.fetchrow(
                """update patients
                      set allergies  = coalesce($2, allergies),
                          conditions = coalesce($3, conditions)
                    where mrn = $1 returning *""",
                mrn, allergies, conditions)
            if record is None:
                raise HTTPException(status_code=404, detail="No patient with that MRN.")

            changed = []
            if allergies is not None:
                changed.append(f"allergies now {', '.join(allergies) or 'none recorded'}")
            if conditions is not None:
                changed.append(f"conditions now {', '.join(conditions) or 'none recorded'}")
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"Updated clinical record ({'; '.join(changed)})", mrn)
    return row(record)
