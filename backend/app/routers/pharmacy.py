from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends

from pydantic import BaseModel, Field

from ..db import connection
from ..security import CurrentUser, require
from ..serialise import rows

router = APIRouter(prefix="/pharmacy", tags=["pharmacy"])

Pharmacist = Annotated[CurrentUser, Depends(require("pharmacist", "admin"))]
Reader = Annotated[CurrentUser, Depends(require("pharmacist", "doctor", "nurse", "admin"))]
Prescriber = Annotated[CurrentUser, Depends(require("doctor", "admin"))]

_PENDING = """select r.*, p.full_name as patient_name, s.full_name as prescriber_name
                from prescriptions r join patients p on p.mrn = r.mrn
                left join staff s on s.id = r.prescriber_id
               where r.status = 'pending' order by r.created_at"""


@router.get("/prescriptions")
async def pending_prescriptions(user: Reader):
    async with connection() as conn:
        return rows(await conn.fetch(_PENDING))


class Dispense(BaseModel):
    """Omit the quantity to give the whole outstanding amount."""
    quantity: int | None = Field(default=None, gt=0)


class Discontinue(BaseModel):
    reason: str = Field(min_length=3, max_length=200)


@router.post("/prescriptions/{rx_id}/discontinue", status_code=204)
async def discontinue(rx_id: int, body: Discontinue, user: Prescriber):
    """
    A drug prescribed in error could not be withdrawn. The row stays,
    because it really was prescribed; the reason records why it stopped.
    """
    async with connection() as conn:
        await conn.execute("select discontinue_prescription($1, $2, $3)",
                           user.id, rx_id, body.reason)


@router.post("/prescriptions/{rx_id}/dispense", status_code=200)
async def dispense(rx_id: int, user: Pharmacist, body: Dispense | None = None):
    """
    Calls the database function. Stock is decremented from current state
    inside one transaction, never read-subtract-write from a copy the
    client held — that was defect D-05. An over-dispense fails rather
    than taking stock negative.
    """
    async with connection() as conn:
        async with conn.transaction():
            remaining = await conn.fetchval(
                "select dispense_prescription($1, $2, $3)",
                rx_id, user.id, body.quantity if body else None)
            await conn.execute(
                "select write_audit($1, $2, $3)", user.id,
                'Dispensed prescription' if remaining == 0
                else f'Part-dispensed prescription, {remaining} outstanding',
                f"rx {rx_id}")
    return {"remaining": remaining}


@router.get("/inventory")
async def inventory(user: Reader):
    """Low-stock and expiry flags are derived here so screens don't recompute them."""
    async with connection() as conn:
        items = rows(await conn.fetch("select * from inventory_items order by name"))
    today = date.today()
    soon = today + timedelta(days=90)
    for item in items:
        expiry = date.fromisoformat(item["expiryDate"]) if item.get("expiryDate") else None
        item["lowStock"] = item["quantity"] < item["reorderLevel"]
        item["expired"] = bool(expiry and expiry < today)
        item["expiringSoon"] = bool(expiry and today <= expiry <= soon)
    return items
