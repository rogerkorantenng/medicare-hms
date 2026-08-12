"""
The non-negotiable business rules from the handoff, tested through the API.

These are the rules the handoff says exist because the hospital exists —
each one is here because relaxing it would harm a patient.
"""

import pytest

from app.acuity import suggest_acuity
from app.safety import check_safety


# ---------- deterministic safety, no API needed ----------

def test_allergy_block_names_the_allergen():
    """A drug matching a recorded allergy cannot be prescribed."""
    result = check_safety("Sarah Johnson", ["Penicillin"], [], "Amoxicillin 500mg")
    assert result["ok"] is False
    assert result["kind"] == "allergy"
    assert "Penicillin" in result["message"]
    assert "Sarah Johnson" in result["message"]


def test_allergy_check_is_deterministic():
    """Same input, same answer — every time. This is why it is not AI."""
    calls = [check_safety("A", ["Penicillin"], [], "Amoxicillin 500mg") for _ in range(25)]
    assert all(c == calls[0] for c in calls)


def test_nsaid_with_anticoagulant_is_blocked():
    result = check_safety("A", [], ["Warfarin 5mg"], "Ibuprofen 400mg")
    assert result["ok"] is False
    assert result["message"] == "INTERACTION — Major bleed risk. NSAID with anticoagulant."


def test_two_raas_agents_are_blocked():
    result = check_safety("A", [], ["Lisinopril 10mg"], "Losartan 50mg")
    assert result["ok"] is False
    assert "RAAS" in result["message"]


def test_duplicate_therapy_is_caught_on_the_ingredient():
    """
    "Metformin 500mg" and "Metformin 850mg" are the same ingredient.

    Deliberately not a RAAS agent: the handoff checks interactions before
    duplicates, so two RAAS drugs correctly report the RAAS interaction
    rather than duplicate therapy. That ordering is the spec, not a bug.
    """
    result = check_safety("A", [], ["Metformin 500mg"], "Metformin 850mg")
    assert result["ok"] is False
    assert result["message"] == "INTERACTION — Duplicate therapy."


def test_rule_order_interactions_before_duplicates():
    """Two identical RAAS agents report the interaction, per the contract."""
    result = check_safety("A", [], ["Lisinopril 10mg"], "Lisinopril 20mg")
    assert result["ok"] is False
    assert "RAAS" in result["message"]


def test_safe_prescription_passes():
    assert check_safety("A", ["Penicillin"], [], "Paracetamol 500mg") == {"ok": True}


def test_acuity_explains_itself():
    """A nurse must be able to see why, not just what."""
    out = suggest_acuity(systolic=190, pulse=140, spo2=88)
    assert out["acuity"] == "urgent"
    assert len(out["reasons"]) >= 3
    assert any("SpO" in r for r in out["reasons"])


def test_acuity_normal_observations():
    out = suggest_acuity(systolic=120, diastolic=80, temperature=36.8, pulse=72, spo2=98)
    assert out["acuity"] == "routine"


# ---------- rules enforced through the API ----------

async def test_prescription_safety_endpoint_blocks_allergy(api, auth):
    """PT-20481 (Sarah Johnson) is allergic to penicillin."""
    response = await api.get(
        "/api/prescriptions/safety",
        params={"mrn": "PT-20481", "drug": "Amoxicillin 500mg"},
        headers=auth("doctor"))
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "Penicillin" in body["message"]


async def test_no_override_route_exists(api, auth):
    """
    A blocked prescription cannot be forced through from a screen. There is
    deliberately no override endpoint — a clinician who judges the drug
    necessary handles it with the pharmacist directly.
    """
    for path in ("/api/prescriptions/override", "/api/prescriptions/safety/override",
                 "/api/prescriptions/force"):
        assert (await api.post(path, headers=auth("doctor"), json={})).status_code == 404


async def test_signing_without_a_diagnosis_is_refused(api, auth):
    response = await api.post("/api/encounters", headers=auth("doctor"), json={
        "mrn": "PT-20524", "complaint": "Headache", "diagnosis": "   "})
    # 409 from the database rule, which carries the better message. Pydantic's
    # min_length lets "   " through, so the constraint is the real guard.
    assert response.status_code in (409, 422)
    assert "diagnosis" in response.json()["detail"].lower()


async def test_implausible_vitals_are_rejected(api, auth):
    response = await api.post("/api/vitals", headers=auth("nurse"),
                              json={"mrn": "PT-20481", "pulse": 400})
    assert response.status_code == 422
    assert "between 20 and 250" in response.json()["detail"]


async def test_free_slots_exclude_bookings(api, auth):
    """Defect D-03: reading the roster and ignoring the bookings."""
    staff = (await api.get("/api/staff", headers=auth("receptionist"))).json()
    doctor = next(s for s in staff if s["staffNo"] == "ST-001")

    slots = (await api.get("/api/appointments/free-slots",
                           params={"doctor_id": doctor["id"], "day": "2026-08-12"},
                           headers=auth("receptionist"))).json()
    assert isinstance(slots, list)

    booked = await api.post("/api/appointments", headers=auth("receptionist"), json={
        "mrn": "PT-20551", "doctorId": doctor["id"],
        "apptDate": "2026-08-12", "apptTime": slots[0], "apptType": "Consultation"})
    assert booked.status_code == 201

    after = (await api.get("/api/appointments/free-slots",
                           params={"doctor_id": doctor["id"], "day": "2026-08-12"},
                           headers=auth("receptionist"))).json()
    assert slots[0] not in after, "a booked slot was still offered"
