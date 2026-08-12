from typing import Annotated

from fastapi import APIRouter, Depends

from ..db import connection
from ..security import BILLING_ROLES, CLINICAL_ROLES, CurrentUser, require
from ..serialise import rows

router = APIRouter(tags=["admin"])

Admin = Annotated[CurrentUser, Depends(require("admin"))]
AnyStaff = Annotated[CurrentUser, Depends(require(*(BILLING_ROLES | CLINICAL_ROLES)))]
AnyUser = Annotated[CurrentUser, Depends(require())]


@router.get("/dashboard")
async def dashboard(user: AnyStaff):
    """Assembled in the database so the client makes one round trip, not a dozen."""
    async with connection() as conn:
        return await conn.fetchval("select dashboard_kpis()")


@router.get("/snapshot")
async def snapshot(user: Admin):
    """The operations copilot's context. Admin only."""
    async with connection() as conn:
        return await conn.fetchval("select hospital_snapshot()")


@router.get("/audit")
async def audit_log(user: Admin, limit: int = 300):
    """
    Read-only by construction. There is no update or delete route on this
    resource anywhere in the API — an audit trail that can be edited is not
    an audit trail.
    """
    async with connection() as conn:
        return rows(await conn.fetch(
            "select * from audit_entries order by occurred_at desc limit $1", limit))


@router.get("/notifications")
async def notifications(user: AnyUser):
    """Mine only — addressed to my MRN or my staff id."""
    async with connection() as conn:
        return rows(await conn.fetch(
            """select * from notifications
                where (mrn is not null and mrn = $1) or staff_id = $2
                order by created_at desc limit 50""",
            user.mrn, user.id))


@router.post("/notifications/{note_id}/read", status_code=204)
async def mark_read(note_id: int, user: AnyUser):
    async with connection() as conn:
        await conn.execute(
            """update notifications set is_read = true
                where id = $1 and ((mrn is not null and mrn = $2) or staff_id = $3)""",
            note_id, user.mrn, user.id)


@router.post("/notifications/read-all", status_code=204)
async def mark_all_read(user: AnyUser):
    async with connection() as conn:
        await conn.execute(
            """update notifications set is_read = true
                where ((mrn is not null and mrn = $1) or staff_id = $2) and not is_read""",
            user.mrn, user.id)
