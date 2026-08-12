import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import prompts
from ..ai import complete
from ..db import connection
from ..queries import chart as chart_q
from ..security import CurrentUser, require

router = APIRouter(prefix="/ai", tags=["ai"])

Doctor = Annotated[CurrentUser, Depends(require("doctor"))]
Clinician = Annotated[CurrentUser, Depends(require("doctor", "nurse", "lab", "radiology"))]


class DraftNote(BaseModel):
    mrn: str
    complaint: str = ""


class ExplainResult(BaseModel):
    testName: str
    resultValue: str
    refRange: str | None = None
    flag: str | None = None


@router.post("/draft-note")
async def draft_note(body: DraftNote, user: Doctor):
    """
    Consultation co-pilot. Fills two editable fields the doctor then owns —
    the draft does not satisfy the diagnosis requirement on its own.
    Data minimisation: only what this task needs, never a bulk transfer.
    """
    async with connection() as conn:
        chart = await chart_q.full(conn, body.mrn, chart_q.View.CLINICAL)
    if chart is None:
        raise HTTPException(status_code=404, detail="No patient with that MRN.")

    patient = chart["patient"]
    latest = chart["vitals"][0] if chart["vitals"] else None
    context = "\n".join([
        f"Age {patient['age']}, {'male' if patient['sex'] == 'M' else 'female'}.",
        f"Known conditions: {', '.join(patient['conditions']) or 'none recorded'}.",
        f"Allergies: {', '.join(patient['allergies']) or 'none recorded'}.",
        (f"Vitals: BP {latest['systolic']}/{latest['diastolic']} mmHg, "
         f"pulse {latest['pulse']} bpm, temperature {latest['temperature']} °C, "
         f"SpO2 {latest['spo2']}%." if latest else "No vitals recorded this visit."),
        f"Presenting complaint: {body.complaint or 'not stated'}.",
    ])

    text = await complete(prompts.DRAFT_NOTE, context, 400)
    if text is None:
        return {"ok": False, "message": prompts.FALLBACK["draft_note"]}

    dx = re.search(r"^DX:\s*(.+)$", text, re.M | re.I)
    plan = re.search(r"^PLAN:\s*([\s\S]+)$", text, re.M | re.I)
    return {
        "ok": True,
        "diagnosis": dx.group(1).strip() if dx else "",
        "plan": plan.group(1).strip() if plan else text.strip(),
    }


@router.post("/explain-result")
async def explain_result(body: ExplainResult, user: Clinician):
    text = await complete(
        prompts.EXPLAIN_RESULT,
        (f"Test: {body.testName}\nResult: {body.resultValue}\n"
         f"Reference range: {body.refRange or 'not stated'}\nFlag: {body.flag or 'none'}"),
        300,
    )
    if text is None:
        return {"ok": False, "message": prompts.FALLBACK["explain_result"]}
    return {"ok": True, "explanation": text.strip()}
