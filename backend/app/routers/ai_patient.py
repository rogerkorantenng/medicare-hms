from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import prompts
from ..ai import complete
from ..db import connection
from ..security import CurrentUser, require, require_own_mrn

router = APIRouter(prefix="/ai", tags=["ai"])

Patient = Annotated[CurrentUser, Depends(require("patient"))]


class Turn(BaseModel):
    role: str
    content: str


class SymptomCheck(BaseModel):
    history: list[Turn]


class LabOrderRef(BaseModel):
    labOrderId: int


@router.post("/explain-result-patient")
async def explain_result_patient(body: LabOrderRef, user: Patient):
    """
    The route verifies the result belongs to the caller and is verified.
    The guard already scopes it, but the handoff asks for the check to be
    explicit rather than relied upon.
    """
    mrn = require_own_mrn(user)
    async with connection() as conn:
        order = await conn.fetchrow(
            """select test_name, result_value, ref_range from lab_orders
                where id = $1 and mrn = $2 and status = 'verified'""",
            body.labOrderId, mrn)
    if order is None:
        raise HTTPException(status_code=404, detail="That result is not available to you.")

    text = await complete(
        prompts.EXPLAIN_RESULT_PATIENT,
        (f"Test: {order['test_name']}\nResult: {order['result_value']}\n"
         f"Normal range: {order['ref_range'] or 'not stated'}"), 250)
    if text is None:
        return {"ok": False, "message": prompts.FALLBACK["explain_result_patient"]}
    return {"ok": True, "explanation": text.strip()}


@router.post("/symptom-check")
async def symptom_check(body: SymptomCheck, user: Patient):
    """Multi-turn. Nothing about any other patient is ever sent."""
    mrn = require_own_mrn(user)
    async with connection() as conn:
        me = await conn.fetchrow(
            "select age, sex, conditions, allergies from patients where mrn = $1", mrn)

    system = prompts.SYMPTOM_CHECK.format(
        age=me["age"] if me else "unknown age",
        sex="male" if me and me["sex"] == "M" else "female" if me else "unspecified",
        conditions=", ".join(me["conditions"]) if me and me["conditions"] else "nothing recorded",
        allergies=", ".join(me["allergies"]) if me and me["allergies"] else "nothing recorded",
    )

    turns = [{"role": t.role, "content": t.content} for t in body.history[-10:]]
    text = await complete(system, turns, 300)
    if text is None:
        return {"ok": False, "message": prompts.FALLBACK["symptom_check"]}

    suggested = next((s for s in prompts.SPECIALTIES if s.lower() in text.lower()), None)
    return {"ok": True, "reply": text.strip(), "suggestedSpecialty": suggested,
            "emergency": "emergency" in text.lower()}
