from typing import Annotated

from fastapi import APIRouter, Depends
from ..acuity import suggest_acuity
from .clinical_models import NewVitals, SignEncounter
from ..db import connection
from ..safety import check_safety
from ..security import CLINICAL_ROLES, CurrentUser, require
from ..serialise import rows

router = APIRouter(tags=["clinical"])

Nurse = Annotated[CurrentUser, Depends(require("nurse", "doctor", "admin"))]
Doctor = Annotated[CurrentUser, Depends(require("doctor"))]
Clinical = Annotated[CurrentUser, Depends(require(*CLINICAL_ROLES))]


@router.post("/vitals", status_code=201)
async def record_vitals(body: NewVitals, user: Nurse):
    """The database rejects implausible readings; this is not the only guard."""
    async with connection() as conn:
        record = await conn.fetchrow(
            """insert into vitals (mrn, recorded_by, systolic, diastolic, temperature,
                                   pulse, spo2, weight_kg, acuity)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9::acuity_enum) returning *""",
            body.mrn, user.id, body.systolic, body.diastolic, body.temperature,
            body.pulse, body.spo2, body.weightKg, body.acuity,
        )
        await conn.execute("select write_audit($1,'Recorded vitals',$2)", user.id, body.mrn)
    return rows([record])[0]


@router.post("/vitals/acuity")
async def acuity_suggestion(body: NewVitals, user: Nurse):
    """Deterministic. Returns the reasons, not just the conclusion."""
    return suggest_acuity(body.systolic, body.diastolic, body.temperature,
                          body.pulse, body.spo2)


@router.get("/prescriptions/safety")
async def prescription_safety(user: Doctor, mrn: str, drug: str):
    """Deterministic, never AI, and there is no override."""
    async with connection() as conn:
        patient = await conn.fetchrow(
            "select full_name, allergies from patients where mrn = $1", mrn)
        active = await conn.fetch(
            "select drug from prescriptions where mrn = $1 and status = 'pending'", mrn)
    if patient is None:
        return {"ok": False, "kind": "interaction",
                "message": "No such patient — do not prescribe."}
    return check_safety(patient["full_name"], list(patient["allergies"] or []),
                        [r["drug"] for r in active], drug)


@router.post("/encounters", status_code=201)
async def sign_encounter(body: SignEncounter, user: Doctor):
    """
    Atomic. One signing stages orders, prescriptions, an invoice line, a
    referral, an admission and a follow-up — all of it commits or none.
    """
    async with connection() as conn:
        # A dict, not a JSON string: db.py registers a jsonb codec whose
        # encoder is json.dumps, so a string would be double-encoded and
        # every field would read back as null.
        encounter_id = await conn.fetchval(
            "select sign_encounter($1, $2)", user.id, body.model_dump(mode="json")
        )
    return {"encounterId": encounter_id}
