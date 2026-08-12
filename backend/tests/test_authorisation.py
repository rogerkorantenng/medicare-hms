"""
The tests that replace row-level security.

Moving authorisation into the API was a deliberate decision, and its cost
is that the database will now hand any row to anyone who asks. These tests
are what stands in for the guarantee RLS used to give — they exercise the
same cases the submitted Testing Report lists as TC-95 to TC-99, against
the API rather than against the database.

If one of these fails, it is a data leak, not a failing test.
"""

import pytest

CLINICAL_ARRAYS = ["encounters", "vitals", "labs", "imaging", "prescriptions", "documents"]


@pytest.mark.parametrize("role", ["cashier", "receptionist"])
async def test_non_clinical_roles_get_no_clinical_data(api, auth, role):
    """TC-96 / TC-97: billing access without clinical access."""
    response = await api.get("/api/patients/PT-20481/chart", headers=auth(role))
    assert response.status_code == 200
    chart = response.json()

    for key in CLINICAL_ARRAYS:
        assert chart[key] == [], f"{role} received {key}"

    # Demographics and billing ARE allowed — that is the point of the split.
    assert chart["patient"]["fullName"]
    assert isinstance(chart["invoices"], list)


async def test_clinical_role_does_get_clinical_data(api, auth):
    """The control: without this, the test above could pass trivially."""
    response = await api.get("/api/patients/PT-20481/chart", headers=auth("doctor"))
    assert response.status_code == 200
    chart = response.json()
    assert chart["labs"], "a doctor should see laboratory results"
    assert chart["prescriptions"], "a doctor should see prescriptions"


async def test_patient_cannot_read_another_patients_chart(api, auth):
    """TC-99. PT-20492 is not the signed-in patient."""
    response = await api.get("/api/patients/PT-20492/chart", headers=auth("patient"))
    assert response.status_code == 403


async def test_patient_can_read_their_own_chart(api, auth):
    response = await api.get("/api/patients/PT-20481/chart", headers=auth("patient"))
    assert response.status_code == 200
    assert response.json()["patient"]["mrn"] == "PT-20481"


async def test_patient_sees_only_verified_results(api, auth):
    """
    "A laboratory result reaches nobody until it is verified." Enforced by
    the release trigger in the database and again by the chart query; this
    checks the patient-facing half.
    """
    response = await api.get("/api/patients/PT-20481/chart", headers=auth("patient"))
    for lab in response.json()["labs"]:
        assert lab["status"] == "verified", f"unverified result leaked: {lab['testName']}"


async def test_patient_can_book_without_reading_the_staff_directory(api, auth):
    """
    A patient must choose a doctor to book, which is a much smaller thing
    than enumerating the hospital's staff. Two routes, two audiences.
    """
    assert (await api.get("/api/staff", headers=auth("patient"))).status_code == 403

    bookable = await api.get("/api/staff/bookable", headers=auth("patient"))
    assert bookable.status_code == 200
    doctors = bookable.json()
    assert doctors, "a patient with no doctors to choose from cannot book"
    # Only what the booking screen renders — no staff numbers, no roles.
    assert set(doctors[0]) == {"id", "fullName", "department", "onDuty"}


async def test_audit_log_is_admin_only(api, auth):
    assert (await api.get("/api/audit", headers=auth("admin"))).status_code == 200
    for role in ("doctor", "cashier", "nurse", "patient"):
        assert (await api.get("/api/audit", headers=auth(role))).status_code == 403


async def test_audit_log_has_no_write_route(api, auth):
    """An audit trail that can be edited is not an audit trail."""
    for method in ("post", "put", "patch", "delete"):
        kwargs = {"headers": auth("admin")}
        if method != "delete":
            kwargs["json"] = {}
        response = await getattr(api, method)("/api/audit", **kwargs)
        assert response.status_code in (404, 405)


@pytest.mark.parametrize(
    "role,method,path",
    [
        ("nurse", "post", "/api/encounters"),          # only a doctor signs
        ("cashier", "post", "/api/encounters"),
        ("doctor", "get", "/api/audit"),               # admin only
        ("cashier", "get", "/api/queue/triage"),       # clinical only
        ("patient", "get", "/api/pharmacy/inventory"),
        ("patient", "get", "/api/invoices"),
        ("receptionist", "post", "/api/pharmacy/prescriptions/1/dispense"),
        ("nurse", "post", "/api/invoices/INV-2089/payment"),
    ],
)
async def test_cross_role_actions_are_refused(api, auth, role, method, path):
    # httpx's .get() takes no json kwarg — only send a body where one is legal.
    kwargs = {"headers": auth(role)}
    if method != "get":
        kwargs["json"] = {}
    response = await getattr(api, method)(path, **kwargs)
    assert response.status_code == 403, f"{role} reached {method.upper()} {path}"


async def test_unauthenticated_requests_are_refused(api):
    for path in ("/api/patients", "/api/queue/triage", "/api/audit", "/api/invoices"):
        assert (await api.get(path)).status_code == 401
