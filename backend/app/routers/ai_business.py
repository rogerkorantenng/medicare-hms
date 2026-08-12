from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import prompts
from ..ai import complete
from ..db import connection
from ..snapshot import format_snapshot
from ..security import CurrentUser, require

router = APIRouter(prefix="/ai", tags=["ai"])

Cashier = Annotated[CurrentUser, Depends(require("cashier", "admin"))]
Admin = Annotated[CurrentUser, Depends(require("admin"))]


class Question(BaseModel):
    question: str


class ClaimRef(BaseModel):
    claimId: str


@router.post("/draft-claim")
async def draft_claim(body: ClaimRef, user: Cashier):
    """The cashier reads and corrects the draft before sending."""
    async with connection() as conn:
        claim = await conn.fetchrow(
            "select insurer, amount, invoice_id from claims where id = $1", body.claimId)
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
