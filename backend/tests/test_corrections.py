"""
Correcting records: your own password, and a patient's details.

The allergy test at the end is the one that matters. Recording an allergy
is not bookkeeping — the prescribing guard reads that list, so a patient
who reports an allergy at triage is protected by nothing until it lands in
the record and the guard starts firing for it.
"""

import uuid

import pytest


async def _register(api, auth, **over):
    body = {"fullName": f"Correction Test {uuid.uuid4().hex[:6]}", "age": 40,
            "sex": "F", "phone": "+233 (24) 000-1111", "bloodGroup": "A+",
            "allergies": [], "conditions": [], "insurance": "NHIS"}
    body.update(over)
    response = await api.post("/api/patients", headers=auth("receptionist"), json=body)
    assert response.status_code == 201
    return response.json()["mrn"]


# ---------------------------------------------------------------- passwords

async def test_a_user_can_change_their_own_password(api, auth):
    """Anyone handed a temporary password has to be able to replace it."""
    issued = "IssuedByAdmin2026!"
    email = f"pw.{uuid.uuid4().hex[:8]}@medicare.com"
    created = await api.post("/api/staff", headers=auth("admin"), json={
        "email": email, "fullName": "Password Tester",
        "role": "nurse", "password": issued})
    assert created.status_code == 201

    token = (await api.post("/api/auth/login", json={
        "email": email, "password": issued})).json()["access_token"]

    changed = await api.post("/api/account/password",
                             headers={"Authorization": f"Bearer {token}"},
                             json={"currentPassword": issued,
                                   "newPassword": "ChosenByMe2026!"})
    assert changed.status_code == 204

    old = await api.post("/api/auth/login", json={"email": email, "password": issued})
    new = await api.post("/api/auth/login",
                         json={"email": email, "password": "ChosenByMe2026!"})
    assert old.status_code == 401 and new.status_code == 200


async def test_the_current_password_is_required(api, auth):
    """A session left open on a ward computer is the realistic threat."""
    response = await api.post("/api/account/password", headers=auth("doctor"), json={
        "currentPassword": "not-the-right-one", "newPassword": "SomethingElse2026!"})
    assert response.status_code == 403


@pytest.mark.parametrize("body", [
    {"currentPassword": "MediCare2026!Demo", "newPassword": "short"},
    {"currentPassword": "MediCare2026!Demo", "newPassword": "MediCare2026!Demo"},
])
async def test_weak_or_unchanged_passwords_are_refused(api, auth, body):
    response = await api.post("/api/account/password", headers=auth("nurse"), json=body)
    assert response.status_code == 422


async def test_changing_a_password_needs_a_session(api):
    response = await api.post("/api/account/password", json={
        "currentPassword": "x", "newPassword": "LongEnoughToPass1!"})
    assert response.status_code == 401


# ---------------------------------------------------------------- demographics

async def test_reception_can_correct_a_typo(api, auth):
    mrn = await _register(api, auth, fullName="Wrogn Nmae")
    fixed = await api.patch(f"/api/patients/{mrn}", headers=auth("receptionist"),
                            json={"fullName": "Correct Name", "phone": "+233 (24) 999-0000"})
    assert fixed.status_code == 200
    assert fixed.json()["fullName"] == "Correct Name"


@pytest.mark.parametrize("role", ["doctor", "nurse", "lab", "cashier", "patient"])
async def test_demographics_are_receptions_to_correct(api, auth, role):
    mrn = await _register(api, auth)
    response = await api.patch(f"/api/patients/{mrn}", headers=auth(role),
                               json={"fullName": "Someone Else"})
    assert response.status_code == 403


async def test_correcting_an_unknown_patient_is_a_404(api, auth):
    response = await api.patch("/api/patients/PT-00000", headers=auth("receptionist"),
                               json={"phone": "+233 (24) 111-2222"})
    assert response.status_code == 404


# ---------------------------------------------------------------- allergies

async def test_recording_an_allergy_makes_the_guard_fire(api, auth):
    """
    The whole point. Before the allergy is recorded the drug is allowed;
    after it is recorded the same drug is refused.
    """
    mrn = await _register(api, auth, allergies=[])

    before = await api.get("/api/prescriptions/safety", headers=auth("doctor"),
                           params={"mrn": mrn, "drug": "Amoxicillin 500mg"})
    assert before.json()["ok"] is True, "nothing recorded, so nothing to block"

    recorded = await api.patch(f"/api/patients/{mrn}/clinical", headers=auth("nurse"),
                               json={"allergies": ["Penicillin"]})
    assert recorded.status_code == 200
    assert recorded.json()["allergies"] == ["Penicillin"]

    after = await api.get("/api/prescriptions/safety", headers=auth("doctor"),
                          params={"mrn": mrn, "drug": "Amoxicillin 500mg"})
    assert after.json()["ok"] is False
    assert after.json()["kind"] == "allergy"
    assert "Penicillin" in after.json()["message"]


async def test_clinical_facts_are_not_a_cashiers_to_change(api, auth):
    mrn = await _register(api, auth)
    response = await api.patch(f"/api/patients/{mrn}/clinical", headers=auth("cashier"),
                               json={"allergies": ["Penicillin"]})
    assert response.status_code == 403


async def test_blank_and_duplicate_entries_are_tidied(api, auth):
    mrn = await _register(api, auth)
    response = await api.patch(f"/api/patients/{mrn}/clinical", headers=auth("doctor"),
                               json={"allergies": ["  Sulfa ", "", "Sulfa", "Pollen"]})
    assert response.json()["allergies"] == ["Sulfa", "Pollen"]
