"""
A patient booking their own appointment.

Kept apart from the staff journey because the failure it guards against
was specific to a patient acting for themselves.
"""

from datetime import date, timedelta


async def test_a_patient_can_book_their_own_appointment(api, auth):
    """
    TC-137. A patient books, and is told it worked.

    The booking always reached the table; what failed was the audit write
    straight after it. audit_entries.staff_id has a foreign key to staff,
    a patient is in users and never in staff, and their id was written
    into that column regardless. The insert had already committed by
    then, so the patient was shown an error for an appointment that
    existed. Both halves are asserted here: the response, and the row.
    """
    doctors = (await api.get("/api/staff", headers=auth("admin"))).json()
    doctor = next(s for s in doctors if s["role"] == "doctor")

    day = (date.today() + timedelta(days=21)).isoformat()
    slots = (await api.get("/api/appointments/free-slots", headers=auth("patient"),
             params={"doctor_id": doctor["id"], "day": day})).json()
    assert slots, "the roster offered no slot to book"

    booked = await api.post("/api/appointments", headers=auth("patient"), json={
        "mrn": "PT-20481", "doctorId": doctor["id"], "specialty": doctor["department"],
        "apptDate": day, "apptTime": slots[0], "apptType": "Consultation",
    })
    assert booked.status_code == 201, booked.text

    listed = (await api.get("/api/appointments", headers=auth("receptionist"))).json()
    assert any(a["apptDate"] == day and a["apptTime"] == slots[0]
               and a["mrn"] == "PT-20481" for a in listed)

    # The trail names the patient and leaves the staff reference empty,
    # because no member of staff did this.
    audit = (await api.get("/api/audit", headers=auth("admin"))).json()
    entry = next(a for a in audit if a["action"] == "Booked appointment"
                 and a["target"] == "PT-20481")
    assert entry["actorName"] == "Sarah Johnson"
