"""
Notification preferences, and the forgot-password request.

The reset request is unauthenticated, which makes it the one place a
stranger can probe for which email addresses exist. The tests below are
mostly about making sure it says nothing either way.
"""

import uuid


async def test_preferences_start_on_and_survive_a_change(api, auth):
    """The switches in the patient app were decoration until now."""
    defaults = await api.get("/api/account/notifications", headers=auth("patient"))
    assert defaults.status_code == 200
    assert defaults.json() == {"results": True, "appointments": True, "billing": True}

    saved = await api.patch("/api/account/notifications", headers=auth("patient"),
                            json={"results": True, "appointments": False, "billing": False})
    assert saved.status_code == 200

    again = await api.get("/api/account/notifications", headers=auth("patient"))
    assert again.json() == {"results": True, "appointments": False, "billing": False}

    # Put them back, so the fixture database is left as it was found.
    await api.patch("/api/account/notifications", headers=auth("patient"),
                    json={"results": True, "appointments": True, "billing": True})


async def test_preferences_need_a_session(api):
    assert (await api.get("/api/account/notifications")).status_code == 401


async def test_a_reset_request_reveals_nothing(api):
    """
    The same answer for a real address and an invented one. Otherwise the
    form is a way to find out who banks, or is treated, here.
    """
    known = await api.post("/api/auth/forgot-password",
                           json={"email": "patient@medicare.com"})
    unknown = await api.post("/api/auth/forgot-password",
                             json={"email": f"nobody.{uuid.uuid4().hex[:8]}@example.com"})

    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()


async def test_reception_sees_the_request_and_can_close_it(api, auth):
    await api.post("/api/auth/forgot-password", json={"email": "patient@medicare.com"})

    open_now = (await api.get("/api/password-requests", headers=auth("receptionist"))).json()
    mine = next(r for r in open_now if r["email"] == "patient@medicare.com")
    assert mine["name"], "reception needs to know who is asking"

    assert (await api.post(f"/api/password-requests/{mine['id']}/handled",
                           headers=auth("receptionist"))).status_code == 204

    still_open = (await api.get("/api/password-requests", headers=auth("receptionist"))).json()
    assert all(r["id"] != mine["id"] for r in still_open)


async def test_the_request_queue_is_not_public(api, auth):
    for role in ("doctor", "nurse", "lab", "cashier", "patient"):
        assert (await api.get("/api/password-requests",
                              headers=auth(role))).status_code == 403
    assert (await api.get("/api/password-requests")).status_code == 401
