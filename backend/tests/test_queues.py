"""
Who appears in which queue.

The nurse's queue and the doctor's queue run the same SQL, and for a while
they returned the same people. A patient checked in at the front desk but
not yet seen by a nurse has no vitals and no acuity, so there is nothing
for a doctor to consult on, and listing them offered a Start consultation
button for somebody triage had not looked at.
"""

import uuid


async def _check_in_a_new_patient(api, auth) -> str:
    unique = uuid.uuid4().hex[:6]
    registered = await api.post("/api/patients", headers=auth("receptionist"), json={
        "fullName": f"Queue Test {unique}", "age": 39, "sex": "F",
        "phone": "+233 (24) 000-0000", "allergies": [], "conditions": []})
    assert registered.status_code == 201
    mrn = registered.json()["mrn"]

    walk_in = await api.post("/api/appointments/walk-in",
                             params={"mrn": mrn}, headers=auth("receptionist"))
    assert walk_in.status_code == 201
    return mrn


async def test_the_untriaged_wait_with_the_nurse_not_the_doctor(api, auth):
    mrn = await _check_in_a_new_patient(api, auth)

    triage = (await api.get("/api/queue/triage", headers=auth("nurse"))).json()
    waiting = next(q for q in triage if q["mrn"] == mrn)
    assert waiting["stage"] == "waiting"
    assert waiting["vitals"] is None

    doctor = (await api.get("/api/queue/doctor", headers=auth("doctor"))).json()
    assert all(q["mrn"] != mrn for q in doctor), \
        "a patient with no vitals should not be offered to a doctor"


async def test_triage_moves_them_into_the_doctors_queue(api, auth):
    mrn = await _check_in_a_new_patient(api, auth)

    recorded = await api.post("/api/vitals", headers=auth("nurse"), json={
        "mrn": mrn, "systolic": 128, "diastolic": 82, "temperature": 36.9,
        "pulse": 74, "spo2": 98, "weightKg": 66.0, "acuity": "routine"})
    assert recorded.status_code == 201

    doctor = (await api.get("/api/queue/doctor", headers=auth("doctor"))).json()
    entry = next(q for q in doctor if q["mrn"] == mrn)
    assert entry["stage"] == "ready_for_doctor"
    assert entry["vitals"]["systolic"] == 128
