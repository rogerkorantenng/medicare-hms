from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..db import connection
from ..security import BILLING_ROLES, CLINICAL_ROLES, CurrentUser, require
from ..serialise import rows

router = APIRouter(prefix="/wards", tags=["wards"])

WardStaff = Annotated[CurrentUser, Depends(require("nurse", "doctor", "admin"))]
AnyStaff = Annotated[CurrentUser, Depends(require(*(BILLING_ROLES | CLINICAL_ROLES)))]

_BOARD = """select b.*, p.full_name as patient_name
              from ward_beds b left join patients p on p.mrn = b.mrn
             order by b.ward, b.bed_no"""


class Admission(BaseModel):
    mrn: str
    ward: str
    bedNo: str


@router.get("")
async def ward_board(user: AnyStaff):
    async with connection() as conn:
        beds = rows(await conn.fetch(_BOARD))
    grouped: dict[str, list[dict]] = {}
    for bed in beds:
        grouped.setdefault(bed["ward"], []).append(bed)
    return [
        {"name": name, "beds": beds_in,
         "occupied": sum(1 for b in beds_in if b["mrn"]), "total": len(beds_in)}
        for name, beds_in in grouped.items()
    ]


@router.post("/admit", status_code=204)
async def admit(body: Admission, user: WardStaff):
    async with connection() as conn:
        await conn.execute("select admit_patient($1,$2,$3,$4)",
                           user.id, body.mrn, body.ward, body.bedNo)


@router.post("/discharge", status_code=204)
async def discharge(user: WardStaff, ward: str, bed_no: str):
    """Frees the bed AND writes the discharge summary, in one transaction."""
    async with connection() as conn:
        await conn.execute("select discharge_patient($1,$2,$3)", user.id, ward, bed_no)


@router.get("/medication-round")
async def medication_round(user: WardStaff):
    """
    Inpatients with a pending prescription. There is no MAR table in the
    entity model and none was added — an administration is recorded as an
    audit entry, which is append-only and already the system's record of
    who did what.
    """
    async with connection() as conn:
        entries = rows(await conn.fetch("select * from medication_round()"))
    for entry in entries:
        frequency = (entry.get("frequency") or "").lower()
        hours = 12 if "twice" in frequency else 8 if ("three" in frequency or "thrice" in frequency) else 24
        entry["dueNow"] = entry.get("lastGivenAt") is None
        entry["intervalHours"] = hours
    return entries


@router.post("/administer/{rx_id}", status_code=204)
async def record_administration(rx_id: int, user: WardStaff):
    async with connection() as conn:
        await conn.execute("select record_administration($1,$2)", user.id, rx_id)
