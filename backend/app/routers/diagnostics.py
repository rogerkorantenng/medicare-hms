from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..db import connection
from ..security import CLINICAL_ROLES, CurrentUser, require
from ..serialise import rows

router = APIRouter(tags=["diagnostics"])

Lab = Annotated[CurrentUser, Depends(require("lab", "admin"))]
Radiology = Annotated[CurrentUser, Depends(require("radiology", "admin"))]
Clinical = Annotated[CurrentUser, Depends(require(*CLINICAL_ROLES))]

_LABS = """select l.*, p.full_name as patient_name, s.full_name as ordered_by_name
             from lab_orders l join patients p on p.mrn = l.mrn
             left join staff s on s.id = l.ordered_by
            where l.status <> 'verified'
            order by l.priority desc, l.created_at"""

_IMAGING = """select i.*, p.full_name as patient_name
                from imaging_orders i join patients p on p.mrn = i.mrn
               where i.status <> 'reported'
               order by i.priority desc, i.created_at"""


class AdvanceLab(BaseModel):
    next: str
    resultValue: str | None = None
    refRange: str | None = None
    flag: str | None = None


class ImagingReport(BaseModel):
    findings: str


@router.get("/lab/worklist")
async def lab_worklist(user: Clinical):
    """STAT first, then oldest first."""
    async with connection() as conn:
        return rows(await conn.fetch(_LABS))


@router.post("/lab/{order_id}/advance", status_code=204)
async def advance_lab(order_id: int, body: AdvanceLab, user: Lab):
    """
    One stage at a time. The trigger refuses a skip, and verification is
    the release point — the release trigger fires only on that transition,
    so nothing reaches the doctor or the patient before it.
    """
    async with connection() as conn:
        async with conn.transaction():
            await conn.execute(
                """update lab_orders
                      set status = $2::lab_status,
                          result_value = coalesce($3, result_value),
                          ref_range = coalesce($4, ref_range),
                          flag = coalesce($5::result_flag, flag)
                    where id = $1""",
                order_id, body.next, body.resultValue, body.refRange, body.flag,
            )
            action = "Verified result" if body.next == "verified" else f"Lab order {body.next}"
            await conn.execute(
                "select write_audit($1, $2, $3)", user.id, action, f"lab order {order_id}"
            )


@router.get("/imaging/worklist")
async def imaging_worklist(user: Clinical):
    async with connection() as conn:
        return rows(await conn.fetch(_IMAGING))


@router.post("/imaging/{order_id}/report", status_code=204)
async def report_imaging(order_id: int, body: ImagingReport, user: Radiology):
    async with connection() as conn:
        async with conn.transaction():
            await conn.execute(
                """update imaging_orders
                      set status = 'reported', findings = $2, reported_by = $3
                    where id = $1""",
                order_id, body.findings, user.id,
            )
            await conn.execute("select write_audit($1,'Reported imaging',$2)",
                               user.id, f"imaging order {order_id}")
