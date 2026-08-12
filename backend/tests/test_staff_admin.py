"""
Managing staff accounts.

These are authorisation tests as much as feature tests: creating an account
is the one action in the system that hands somebody clinical access, so the
guard on it matters more than most.
"""

import uuid

import pytest


def _new(**over):
    unique = uuid.uuid4().hex[:8]
    body = {
        "email": f"test.{unique}@medicare.com",
        "fullName": f"Test Person {unique}",
        "role": "nurse",
        "department": "Outpatient",
        "password": "TemporaryPass2026!",
    }
    body.update(over)
    return body


@pytest.mark.parametrize("role", ["doctor", "nurse", "receptionist", "cashier",
                                  "lab", "radiology", "pharmacist", "patient"])
async def test_only_an_administrator_may_create_staff(api, auth, role):
    """Creating an account grants access. Nobody but an admin may do it."""
    response = await api.post("/api/staff", headers=auth(role), json=_new())
    assert response.status_code == 403


async def test_create_allocates_a_staff_number_and_audits(api, auth):
    body = _new()
    created = await api.post("/api/staff", headers=auth("admin"), json=body)
    assert created.status_code == 201

    record = created.json()
    assert record["staffNo"].startswith("ST-")
    assert record["fullName"] == body["fullName"]
    assert record["onDuty"] is True

    # The new account works, which is the only proof that matters.
    signed_in = await api.post("/api/auth/login", json={
        "email": body["email"], "password": body["password"]})
    assert signed_in.status_code == 200
    assert signed_in.json()["user"]["role"] == "nurse"

    audit = (await api.get("/api/audit", headers=auth("admin"))).json()
    assert any(a["action"] == "Created staff account (nurse)"
               and a["target"] == body["fullName"] for a in audit)


async def test_duplicate_email_is_refused(api, auth):
    body = _new()
    assert (await api.post("/api/staff", headers=auth("admin"), json=body)).status_code == 201
    again = await api.post("/api/staff", headers=auth("admin"), json=body)
    assert again.status_code == 409


@pytest.mark.parametrize("bad", [
    {"role": "wizard"},                  # not a role
    {"role": "patient"},                 # a role, but not a staff one
    {"password": "short"},               # under the minimum
    {"email": "not-an-address"},
    {"fullName": "X"},                   # too short to be a name
])
async def test_invalid_input_is_refused(api, auth, bad):
    response = await api.post("/api/staff", headers=auth("admin"), json=_new(**bad))
    assert response.status_code in (409, 422)


async def test_deactivating_blocks_sign_in_and_keeps_the_record(api, auth):
    """
    A staff record is never deleted. Past clinical actions reference the
    person who performed them, so the row has to stay.
    """
    body = _new()
    staff_id = (await api.post("/api/staff", headers=auth("admin"), json=body)).json()["id"]

    assert (await api.patch(f"/api/staff/{staff_id}", headers=auth("admin"),
                            json={"isActive": False})).status_code == 204

    refused = await api.post("/api/auth/login", json={
        "email": body["email"], "password": body["password"]})
    assert refused.status_code == 401

    directory = (await api.get("/api/staff", headers=auth("admin"))).json()
    still_there = next(s for s in directory if s["id"] == staff_id)
    assert still_there["isActive"] is False
    assert still_there["onDuty"] is False, "a deactivated person is not on duty"


async def test_reset_password_replaces_the_old_one(api, auth):
    body = _new()
    staff_id = (await api.post("/api/staff", headers=auth("admin"), json=body)).json()["id"]

    assert (await api.post(f"/api/staff/{staff_id}/password", headers=auth("admin"),
                           json={"password": "ADifferentPass2026!"})).status_code == 204

    old = await api.post("/api/auth/login", json={
        "email": body["email"], "password": body["password"]})
    new = await api.post("/api/auth/login", json={
        "email": body["email"], "password": "ADifferentPass2026!"})
    assert old.status_code == 401 and new.status_code == 200


async def test_role_change_moves_both_tables(api, auth):
    """
    The role is stored on the account and on the staff record. If they
    drift apart, the guards and the directory disagree about who someone is.
    """
    body = _new(role="nurse")
    staff_id = (await api.post("/api/staff", headers=auth("admin"), json=body)).json()["id"]

    assert (await api.patch(f"/api/staff/{staff_id}", headers=auth("admin"),
                            json={"role": "pharmacist"})).status_code == 204

    signed_in = await api.post("/api/auth/login", json={
        "email": body["email"], "password": body["password"]})
    assert signed_in.json()["user"]["role"] == "pharmacist"

    directory = (await api.get("/api/staff", headers=auth("admin"))).json()
    assert next(s for s in directory if s["id"] == staff_id)["role"] == "pharmacist"


async def test_an_administrator_cannot_lock_themselves_out(api, auth, admin_id):
    """The ordinary way an organisation ends up with no administrator."""
    for change in ({"isActive": False}, {"role": "nurse"}):
        response = await api.patch(f"/api/staff/{admin_id}", headers=auth("admin"),
                                   json=change)
        assert response.status_code == 409, f"self {change} was allowed"


async def test_password_reset_is_admin_only(api, auth, admin_id):
    for role in ("doctor", "nurse", "cashier"):
        response = await api.post(f"/api/staff/{admin_id}/password", headers=auth(role),
                                  json={"password": "IrrelevantButLong1!"})
        assert response.status_code == 403


async def test_there_is_no_delete_route_for_staff(api, auth, admin_id):
    """Deactivation is the only removal. A deleted author breaks the trail."""
    response = await api.delete(f"/api/staff/{admin_id}", headers=auth("admin"))
    assert response.status_code in (404, 405)
