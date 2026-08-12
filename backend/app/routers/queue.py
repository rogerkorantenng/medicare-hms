from typing import Annotated

from fastapi import APIRouter, Depends

from ..db import connection
from ..security import CLINICAL_ROLES, CurrentUser, require
from ..serialise import rows

router = APIRouter(prefix="/queue", tags=["queue"])

Clinical = Annotated[CurrentUser, Depends(require(*CLINICAL_ROLES, "receptionist"))]

# The entity model has no queue table and none was added. A queue entry is
# a checked-in appointment: waiting until a nurse records vitals, ready for
# the doctor afterwards.
_QUEUE = """
    with today_vitals as (
      select distinct on (mrn) * from vitals
       where recorded_at::date = current_date
       order by mrn, recorded_at desc
    )
    select a.id as appointment_id, a.mrn, a.doctor_id,
           p.full_name as patient_name, p.age, p.sex,
           case when a.appt_type = 'Walk-in' then 'Walk-in'
                else coalesce(a.specialty, a.appt_type) end as reason,
           to_char(a.appt_time, 'HH24:MI') as waiting_since,
           v.acuity,
           case when v.id is null then 'waiting' else 'ready_for_doctor' end as stage,
           v.systolic, v.diastolic, v.temperature, v.pulse, v.spo2, v.weight_kg,
           v.recorded_at
      from appointments a
      join patients p on p.mrn = a.mrn
      left join today_vitals v on v.mrn = a.mrn
     where a.status = 'checked_in' and a.appt_date = current_date
       and ($1::uuid is null or a.doctor_id = $1)
     order by a.appt_time
"""


def _shape(record: dict) -> dict:
    """Nest the vitals columns so the shape matches the QueueEntry type."""
    vitals = None
    if record.get("recordedAt"):
        vitals = {
            "systolic": record.pop("systolic"), "diastolic": record.pop("diastolic"),
            "temperature": record.pop("temperature"), "pulse": record.pop("pulse"),
            "spo2": record.pop("spo2"), "weightKg": record.pop("weightKg"),
            "recordedAt": record.pop("recordedAt"), "acuity": record.get("acuity"),
        }
    else:
        for key in ("systolic", "diastolic", "temperature", "pulse", "spo2",
                    "weightKg", "recordedAt"):
            record.pop(key, None)
    record["vitals"] = vitals
    return record


@router.get("/triage")
async def triage_queue(user: Clinical):
    async with connection() as conn:
        return [_shape(r) for r in rows(await conn.fetch(_QUEUE, None))]


@router.get("/doctor")
async def doctor_queue(user: Clinical, doctor_id: str | None = None):
    """Defaults to the signed-in doctor's own queue."""
    target = doctor_id or (str(user.id) if user.role == "doctor" else None)
    async with connection() as conn:
        return [_shape(r) for r in rows(await conn.fetch(_QUEUE, target))]
