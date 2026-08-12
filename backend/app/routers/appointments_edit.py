"""
The rest of an appointment's life: cancelling, rescheduling and
recording that somebody did not turn up.

The schema always had a 'cancelled' status and nothing could set it, so
a booking made in error stayed on the schedule forever and the slot was
never released.

A did-not-attend is not a cancellation. The slot was held and wasted,
and a clinic measuring utilisation needs to tell the two apart.
"""

from datetime import date as Date
from datetime import time as Time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import connection
from ..security import CurrentUser, require, scope_to_patient
from ..serialise import row

router = APIRouter(prefix="/appointments", tags=["appointments"])

Desk = Annotated[CurrentUser, Depends(require("receptionist", "admin", "doctor"))]
# A patient may cancel their own booking, which is why this is wider.
Booker = Annotated[CurrentUser, Depends(
    require("receptionist", "admin", "doctor", "patient"))]


class Cancellation(BaseModel):
    reason: str = Field(min_length=3, max_length=200)


class Reschedule(BaseModel):
    apptDate: Date
    apptTime: str

    @property
    def slot(self) -> Time:
        return Time.fromisoformat(self.apptTime)


async def _owner(conn, appointment_id: int) -> str:
    mrn = await conn.fetchval("select mrn from appointments where id = $1", appointment_id)
    if mrn is None:
        raise HTTPException(status_code=404, detail="No such appointment.")
    return mrn


@router.post("/{appointment_id}/cancel", status_code=204)
async def cancel(appointment_id: int, body: Cancellation, user: Booker):
    async with connection() as conn:
        scope_to_patient(user, await _owner(conn, appointment_id))
        await conn.execute("select cancel_appointment($1, $2, $3)",
                           user.id, appointment_id, body.reason)


@router.post("/{appointment_id}/did-not-attend", status_code=204)
async def did_not_attend(appointment_id: int, user: Desk):
    async with connection() as conn:
        await conn.execute("select mark_did_not_attend($1, $2)", user.id, appointment_id)


@router.post("/{appointment_id}/reschedule", status_code=200)
async def reschedule(appointment_id: int, body: Reschedule, user: Booker):
    """
    Moves the booking rather than cancelling and rebooking, so the
    appointment keeps its identity and its history. The double-booking
    index still applies, so two desks racing for the same slot cannot
    both win.
    """
    async with connection() as conn:
        async with conn.transaction():
            current = await conn.fetchrow(
                """select mrn, doctor_id, appt_date, appt_time, status
                     from appointments where id = $1""", appointment_id)
            if current is None:
                raise HTTPException(status_code=404, detail="No such appointment.")
            scope_to_patient(user, current["mrn"])
            if current["status"] not in ("confirmed", "checked_in"):
                raise HTTPException(
                    status_code=409,
                    detail="Only an open appointment can be moved.")

            free = await conn.fetchval(
                "select 1 from free_slots($1, $2) s where s = $3",
                current["doctor_id"], body.apptDate, body.apptTime)
            if not free:
                raise HTTPException(
                    status_code=409,
                    detail="That slot is not free. The doctor may not be working then.")

            record = await conn.fetchrow(
                """update appointments set appt_date = $2, appt_time = $3
                    where id = $1 returning *""",
                appointment_id, body.apptDate, body.slot)
            await conn.execute(
                "select write_audit($1, $2, $3)", user.id,
                f"Moved appointment to {body.apptDate} {body.apptTime}", current["mrn"])
    return row(record)
