"""
Portal access, staff messages and reports.

The quiet one here is portal access. A patient registered at the front
desk could never sign in, because nothing created an account for them.
The mobile application was built for people who had no way to reach it.
"""

import csv
import io
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field

from ..db import connection
from ..security import CurrentUser, hash_password, require
from ..serialise import row, rows

router = APIRouter(tags=["operations"])

Desk = Annotated[CurrentUser, Depends(require("receptionist", "admin"))]
Admin = Annotated[CurrentUser, Depends(require("admin"))]
AnyStaff = Annotated[CurrentUser, Depends(require(
    "doctor", "nurse", "receptionist", "lab", "radiology", "pharmacist",
    "cashier", "admin"))]


class PortalAccess(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12)


class Message(BaseModel):
    toStaffId: str
    title: str = Field(min_length=2, max_length=160)
    body: str = Field(min_length=2, max_length=2000)
    kind: str = "info"


@router.post("/patients/{mrn}/portal-access", status_code=201)
async def grant_portal_access(mrn: str, body: PortalAccess, user: Desk):
    """
    Creates the patient's sign-in account and links it to their record.
    They are required to change the password at first sign-in, because
    whoever typed it knows it.
    """
    async with connection() as conn:
        try:
            user_id = await conn.fetchval(
                "select grant_portal_access($1, $2, $3, $4)",
                user.id, mrn, body.email, hash_password(body.password))
        except Exception as exc:
            raise HTTPException(status_code=409, detail=str(exc).split("\n")[0]) from exc
    return {"userId": str(user_id), "email": body.email, "mustChangePassword": True}


@router.post("/notifications", status_code=201)
async def send_message(body: Message, user: AnyStaff):
    """
    Staff to staff. Notifications could only be raised by the
    result-release trigger, so there was no handover and no way to ask a
    colleague to look at something.
    """
    if body.kind not in {"info", "critical"}:
        raise HTTPException(status_code=422, detail="Kind must be info or critical.")
    async with connection() as conn:
        async with conn.transaction():
            known = await conn.fetchval(
                "select full_name from staff where id = $1", body.toStaffId)
            if known is None:
                raise HTTPException(status_code=404, detail="No such staff member.")
            record = await conn.fetchrow(
                """insert into notifications (staff_id, kind, title, body)
                   values ($1, $2, $3, $4) returning id""",
                body.toStaffId, body.kind, body.title,
                f"{body.body}\n\nFrom {user.full_name}.")
    return {"id": record["id"], "to": known}


@router.get("/reports/summary")
async def summary(user: Admin, days: int = Query(7, ge=1, le=90)):
    """
    Counts an administrator is otherwise asked for verbally: attendance,
    the no-show rate, what was earned and what was written off.
    """
    async with connection() as conn:
        # row(), not dict(): the frontend contract is camelCase, and a raw
        # asyncpg record hands back did_not_attend and written_off, which
        # arrive at the screen as undefined.
        return row(await conn.fetchrow(
            """
            select
              (select count(*) from appointments
                where appt_date >= current_date - $1::int) as appointments,
              (select count(*) from appointments
                where appt_date >= current_date - $1::int and did_not_attend) as did_not_attend,
              (select count(*) from appointments
                where appt_date >= current_date - $1::int and status = 'cancelled') as cancelled,
              (select count(*) from encounters
                where created_at >= now() - make_interval(days => $1::int)) as consultations,
              (select coalesce(sum(amount), 0) from payments
                where taken_at >= now() - make_interval(days => $1::int) and amount > 0) as collected,
              (select coalesce(sum(-amount), 0) from payments
                where taken_at >= now() - make_interval(days => $1::int) and amount < 0) as refunded,
              (select coalesce(sum(written_off), 0) from invoices) as written_off,
              (select count(*) from patients) as patients
            """, days))


@router.get("/reports/audit.csv")
async def audit_csv(user: Admin, days: int = Query(30, ge=1, le=365)):
    """The audit trail as a file, for anyone who needs it outside the screen."""
    async with connection() as conn:
        entries = await conn.fetch(
            """select occurred_at, actor_name, action, target from audit_entries
                where occurred_at >= now() - make_interval(days => $1::int)
                order by occurred_at desc""", days)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["When", "Who", "Action", "Target"])
    for entry in entries:
        writer.writerow([entry["occurred_at"].isoformat(), entry["actor_name"],
                         entry["action"], entry["target"] or ""])
    buffer.seek(0)

    return StreamingResponse(
        buffer, media_type="text/csv",
        headers={"content-disposition": 'attachment; filename="audit-trail.csv"'})
