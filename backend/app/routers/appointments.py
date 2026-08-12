from datetime import date as Date
from datetime import time as Time
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from ..db import connection
from ..security import BILLING_ROLES, CLINICAL_ROLES, CurrentUser, require, scope_to_patient
from ..serialise import rows

router = APIRouter(prefix="/appointments", tags=["appointments"])

Staff = Annotated[CurrentUser, Depends(require(*(BILLING_ROLES | CLINICAL_ROLES)))]
Booker = Annotated[CurrentUser, Depends(require("receptionist", "doctor", "admin", "patient"))]
Desk = Annotated[CurrentUser, Depends(require("receptionist", "admin"))]
AnyUser = Annotated[CurrentUser, Depends(require())]

_LIST = """
    select a.*, p.full_name as patient_name,
           s.full_name as doctor_name, s.department as doctor_department
      from appointments a
      join patients p on p.mrn = a.mrn
      left join staff s on s.id = a.doctor_id
     where ($1::date is null or a.appt_date >= $1)
       and ($2::text is null or a.mrn = $2)
     order by a.appt_date, a.appt_time
     limit 200
"""


class NewAppointment(BaseModel):
    mrn: str
    doctorId: str
    specialty: str | None = None
    apptDate: Date
    apptTime: str
    apptType: str = "Consultation"

    @property
    def slot(self) -> Time:
        """
        asyncpg infers $n::time as a time parameter, so the cast is applied
        after binding and a bare "09:30" is rejected. Parse it here.
        """
        return Time.fromisoformat(self.apptTime)


@router.get("")
async def list_appointments(
    user: AnyUser, mrn: str | None = None, since: Date | None = None
):
    # A patient may only ever list their own appointments.
    if user.role == "patient":
        mrn = user.mrn
    elif mrn:
        scope_to_patient(user, mrn)
    async with connection() as conn:
        return rows(await conn.fetch(_LIST, since, mrn))


@router.get("/free-slots")
async def free_slots(user: Booker, doctor_id: str = Query(...), day: Date = Query(...)):
    """
    Queries the roster AND the bookings. Reading only the roster was
    defect D-03, so this calls the database function that does both.
    """
    async with connection() as conn:
        found = await conn.fetch("select * from free_slots($1, $2)", doctor_id, day)
    return [r[0][:5] for r in found]


@router.post("", status_code=201)
async def book(body: NewAppointment, user: Booker):
    scope_to_patient(user, body.mrn)
    async with connection() as conn:
        record = await conn.fetchrow(
            """insert into appointments (mrn, doctor_id, specialty, appt_date, appt_time, appt_type)
               values ($1, $2, $3, $4, $5, $6) returning *""",
            body.mrn, body.doctorId, body.specialty, body.apptDate, body.slot, body.apptType,
        )
        await conn.execute(
            "select write_audit($1, 'Booked appointment', $2)", user.id, body.mrn
        )
    return rows([record])[0]


@router.post("/{appointment_id}/check-in", status_code=204)
async def check_in(appointment_id: int, user: Desk):
    async with connection() as conn:
        await conn.execute("select check_in_appointment($1, $2)", user.id, appointment_id)


@router.post("/walk-in", status_code=201)
async def walk_in(user: Desk, mrn: str = Query(...)):
    async with connection() as conn:
        new_id = await conn.fetchval("select add_walk_in($1, $2)", user.id, mrn)
    return {"appointmentId": new_id}
