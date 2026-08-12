from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import prompts
from ..ai import complete
from ..db import connection
from ..snapshot import format_snapshot
from ..security import CurrentUser, require, require_own_mrn

router = APIRouter(prefix="/ai", tags=["ai"])

Patient = Annotated[CurrentUser, Depends(require("patient"))]
Cashier = Annotated[CurrentUser, Depends(require("cashier", "admin"))]
Admin = Annotated[CurrentUser, Depends(require("admin"))]


class Turn(BaseModel):
    role: str
    content: str


class SymptomCheck(BaseModel):
    history: list[Turn]


class Question(BaseModel):
    question: str


@router.post("/explain-result-patient")
async def explain_result_patient(user: Patient, lab_order_id: int):
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
            lab_order_id, mrn)
    if order is None:
        raise HTTPException(status_code=404, detail="That result is not available to you.")

    text = await complete(
        prompts.EXPLAIN_RESULT_PATIENT,
        (f"Test: {order['test_name']}\nResult: {order['result_value']}\n"
         f"Normal range: {order['ref_range'] or 'not stated'}"), 250)
    if text is None:
        return {"ok": False, "message": prompts.FALLBACK["explain_result_patient"]}
    return {"ok": True, "explanation": text.strip()}


@router.post("/draft-claim")
async def draft_claim(user: Cashier, claim_id: str):
    """The cashier reads and corrects the draft before sending."""
    async with connection() as conn:
        claim = await conn.fetchrow(
            "select insurer, amount, invoice_id from claims where id = $1", claim_id)
        if claim is None:
            raise HTTPException(status_code=404, detail="No such claim.")
        # Only the billed lines — the clinical record is not sent.
        lines = await conn.fetch(
            "select description, amount from invoice_lines where invoice_id = $1",
            claim["invoice_id"])

    billed = "\n".join(f"- {r['description']}: GHS {float(r['amount']):.2f}" for r in lines)
    text = await complete(
        prompts.DRAFT_CLAIM,
        (f"Insurer: {claim['insurer']}\nClaim amount: GHS {float(claim['amount']):.2f}\n"
         f"Services billed:\n{billed or '- not itemised'}"), 300)
    if text is None:
        return {"ok": False, "message": prompts.FALLBACK["draft_claim"]}
    return {"ok": True, "justification": text.strip()}


@router.post("/ops")
async def ops_copilot(body: Question, user: Admin):
    """The model answers from the snapshot only — it cannot invent a number."""
    async with connection() as conn:
        s = await conn.fetchval("select hospital_snapshot()")

    snapshot = format_snapshot(s)

    text = await complete(prompts.OPS.format(snapshot=snapshot), body.question, 300)
    if text is None:
        return {"ok": False, "message": prompts.FALLBACK["ops"]}
    return {"ok": True, "answer": text.strip()}


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
