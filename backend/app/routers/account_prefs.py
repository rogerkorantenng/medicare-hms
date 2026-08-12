"""
Notification preferences, and the forgot-password request.

The reset flow deserves a note. This system has no outbound email, and
pretending otherwise would be worse than not having the feature at all: a
patient would wait for a message that never arrives. So a request is
raised for reception to act on at the desk against photo identification,
which is how a hospital verifies somebody in person regardless.

The request carries no token and grants nothing. It is a note that
somebody asked.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr

from ..db import connection
from ..security import CurrentUser, require
from ..serialise import rows

router = APIRouter(tags=["account"])

AnyUser = Annotated[CurrentUser, Depends(require())]
Desk = Annotated[CurrentUser, Depends(require("receptionist", "admin"))]


class Preferences(BaseModel):
    results: bool = True
    appointments: bool = True
    billing: bool = True


class ResetRequest(BaseModel):
    email: EmailStr


@router.get("/account/notifications", response_model=Preferences)
async def read_preferences(user: AnyUser) -> Preferences:
    async with connection() as conn:
        stored = await conn.fetchval(
            "select notify_prefs from users where id = $1", user.id)
    return Preferences(**(stored or {}))


@router.patch("/account/notifications", response_model=Preferences)
async def write_preferences(body: Preferences, user: AnyUser) -> Preferences:
    async with connection() as conn:
        await conn.execute(
            "update users set notify_prefs = $2 where id = $1",
            user.id, body.model_dump())
    return body


@router.post("/auth/forgot-password", status_code=202)
async def request_password_reset(body: ResetRequest):
    """
    Unauthenticated, and deliberately incurious.

    The same response comes back whether or not the address is registered,
    and a row is written either way, so the form cannot be used to discover
    which addresses exist.
    """
    email = body.email.strip().lower()
    async with connection() as conn:
        owner = await conn.fetchval(
            "select id from users where lower(email) = $1 and is_active", email)
        await conn.execute(
            "insert into password_reset_requests (email, user_id) values ($1, $2)",
            email, owner)
    return {
        "message": "If that address is registered, the front desk can reset it. "
                   "Bring photo identification to reception, or call the hospital.",
    }


@router.get("/password-requests")
async def open_requests(user: Desk):
    """What reception acts on. Open requests, newest first."""
    async with connection() as conn:
        return rows(await conn.fetch(
            """select r.id, r.email, r.requested_at,
                      coalesce(s.full_name, p.full_name) as name,
                      p.mrn
                 from password_reset_requests r
                 left join staff s on s.id = r.user_id
                 left join patients p on p.user_id = r.user_id
                where r.handled_at is null
                order by r.requested_at desc limit 50"""))


@router.post("/password-requests/{request_id}/handled", status_code=204)
async def mark_handled(request_id: int, user: Desk):
    async with connection() as conn:
        await conn.execute(
            """update password_reset_requests
                  set handled_at = now(), handled_by = $2
                where id = $1 and handled_at is null""",
            request_id, user.id)
