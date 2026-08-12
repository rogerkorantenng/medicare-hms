"""
Doctor rosters and leave.

free_slots() used to offer the same ten times to every doctor, every
day, weekends included, whether or not they were on leave. Booking is
the system's front door, so that was the most visible piece of fiction
in it.

A doctor with no schedule row for a weekday is not working that day.
Not working is the default; a schedule is a statement that they are.
"""

from datetime import date as Date
from datetime import time as Time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import connection
from ..security import CurrentUser, require
from ..serialise import row, rows

router = APIRouter(prefix="/rosters", tags=["rosters"])

Manager = Annotated[CurrentUser, Depends(require("admin", "receptionist"))]
AnyUser = Annotated[CurrentUser, Depends(require())]

DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


class Shift(BaseModel):
    doctorId: str
    dayOfWeek: int = Field(ge=0, le=6, description="0 is Sunday")
    startsAt: str
    endsAt: str
    slotMinutes: int = Field(default=30, ge=5, le=240)


class Leave(BaseModel):
    doctorId: str
    startsOn: Date
    endsOn: Date
    reason: str | None = None


@router.get("/{doctor_id}")
async def doctor_roster(doctor_id: str, user: AnyUser):
    """The weekly pattern and any booked leave."""
    async with connection() as conn:
        shifts = await conn.fetch(
            """select * from doctor_schedules where doctor_id = $1
                order by day_of_week, starts_at""", doctor_id)
        leave = await conn.fetch(
            """select * from doctor_leave where doctor_id = $1 and ends_on >= current_date
                order by starts_on""", doctor_id)
    return {
        "shifts": [dict(row(s), dayName=DAYS[s["day_of_week"]]) for s in shifts],
        "leave": rows(leave),
    }


@router.post("/shifts", status_code=201)
async def add_shift(body: Shift, user: Manager):
    starts, ends = Time.fromisoformat(body.startsAt), Time.fromisoformat(body.endsAt)
    if ends <= starts:
        raise HTTPException(status_code=422, detail="The shift must end after it starts.")

    async with connection() as conn:
        async with conn.transaction():
            record = await conn.fetchrow(
                """insert into doctor_schedules
                     (doctor_id, day_of_week, starts_at, ends_at, slot_minutes)
                   values ($1, $2, $3, $4, $5) returning *""",
                body.doctorId, body.dayOfWeek, starts, ends, body.slotMinutes)
            name = await conn.fetchval("select full_name from staff where id = $1",
                                       body.doctorId)
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"Added {DAYS[body.dayOfWeek]} clinic "
                               f"{body.startsAt}-{body.endsAt}", name)
    return row(record)


@router.delete("/shifts/{shift_id}", status_code=204)
async def remove_shift(shift_id: int, user: Manager):
    """
    Removing a shift does not touch appointments already booked into it.
    Those are somebody's arrangements; they are cancelled deliberately or
    not at all.
    """
    async with connection() as conn:
        async with conn.transaction():
            gone = await conn.fetchrow(
                """delete from doctor_schedules where id = $1
                   returning doctor_id, day_of_week""", shift_id)
            if gone is None:
                raise HTTPException(status_code=404, detail="No such shift.")
            name = await conn.fetchval("select full_name from staff where id = $1",
                                       gone["doctor_id"])
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"Removed {DAYS[gone['day_of_week']]} clinic", name)


@router.post("/leave", status_code=201)
async def book_leave(body: Leave, user: Manager):
    if body.endsOn < body.startsOn:
        raise HTTPException(status_code=422, detail="Leave must end on or after it starts.")

    async with connection() as conn:
        async with conn.transaction():
            record = await conn.fetchrow(
                """insert into doctor_leave (doctor_id, starts_on, ends_on, reason)
                   values ($1, $2, $3, $4) returning *""",
                body.doctorId, body.startsOn, body.endsOn, body.reason)
            name = await conn.fetchval("select full_name from staff where id = $1",
                                       body.doctorId)
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"Booked leave {body.startsOn} to {body.endsOn}", name)
    return row(record)


@router.delete("/leave/{leave_id}", status_code=204)
async def cancel_leave(leave_id: int, user: Manager):
    async with connection() as conn:
        await conn.execute("delete from doctor_leave where id = $1", leave_id)
