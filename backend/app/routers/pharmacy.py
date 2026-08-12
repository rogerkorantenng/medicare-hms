from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends

from ..db import connection
from ..security import CurrentUser, require
from ..serialise import rows

router = APIRouter(prefix="/pharmacy", tags=["pharmacy"])

Pharmacist = Annotated[CurrentUser, Depends(require("pharmacist", "admin"))]
Reader = Annotated[CurrentUser, Depends(require("pharmacist", "doctor", "nurse", "admin"))]

_PENDING = """select r.*, p.full_name as patient_name, s.full_name as prescriber_name
                from prescriptions r join patients p on p.mrn = r.mrn
                left join staff s on s.id = r.prescriber_id
               where r.status = 'pending' order by r.created_at"""


@router.get("/prescriptions")
async def pending_prescriptions(user: Reader):
    async with connection() as conn:
        return rows(await conn.fetch(_PENDING))


@router.post("/prescriptions/{rx_id}/dispense", status_code=204)
async def dispense(rx_id: int, user: Pharmacist):
    """
    Calls the database function. Stock is decremented from current state
    inside one transaction, never read-subtract-write from a copy the
    client held — that was defect D-05. An over-dispense fails rather
    than taking stock negative.
    """
    async with connection() as conn:
        async with conn.transaction():
            await conn.execute("select dispense_prescription($1, $2)", rx_id, user.id)
            await conn.execute("select write_audit($1,'Dispensed prescription',$2)",
                               user.id, f"rx {rx_id}")


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
