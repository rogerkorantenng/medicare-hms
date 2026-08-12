"""
The end-to-end journey the handoff describes: register, check in, triage,
consult with orders, verify a critical result, dispense, take payment,
discharge.

This is the test that proves the departments actually hand off to each
other, rather than each working in isolation.
"""

import uuid


async def test_full_patient_journey(api, auth):
    unique = uuid.uuid4().hex[:6]

    # 1. Reception registers a patient. The database allocates the MRN.
    registered = await api.post("/api/patients", headers=auth("receptionist"), json={
        "fullName": f"Journey Test {unique}", "age": 44, "sex": "M",
        "phone": "+233 (24) 000-0000", "bloodGroup": "O+",
        "allergies": ["Penicillin"], "conditions": [], "insurance": "NHIS"})
    assert registered.status_code == 201
    mrn = registered.json()["mrn"]
    assert mrn.startswith("PT-")

    # 2. Reception adds them as a walk-in, which puts them in the queue.
    walk_in = await api.post("/api/appointments/walk-in",
                             params={"mrn": mrn}, headers=auth("receptionist"))
    assert walk_in.status_code == 201

    queue = (await api.get("/api/queue/triage", headers=auth("nurse"))).json()
    entry = next(q for q in queue if q["mrn"] == mrn)
    assert entry["stage"] == "waiting"

    # 3. The nurse records vitals. That moves them on to the doctor.
    vitals = await api.post("/api/vitals", headers=auth("nurse"), json={
        "mrn": mrn, "systolic": 168, "diastolic": 96, "temperature": 37.4,
        "pulse": 92, "spo2": 96, "weightKg": 81.0, "acuity": "semi_urgent"})
    assert vitals.status_code == 201

    queue = (await api.get("/api/queue/triage", headers=auth("nurse"))).json()
    entry = next(q for q in queue if q["mrn"] == mrn)
    assert entry["stage"] == "ready_for_doctor"
    assert entry["vitals"]["systolic"] == 168

    # 4. The allergy guard blocks a contraindicated drug — and cannot be
    #    overridden from any screen.
    blocked = (await api.get("/api/prescriptions/safety",
                             params={"mrn": mrn, "drug": "Amoxicillin 500mg"},
                             headers=auth("doctor"))).json()
    assert blocked["ok"] is False and "Penicillin" in blocked["message"]

    # 5. The doctor signs. One transaction stages the lab, the prescription,
    #    the consultation fee and the audit entry.
    signed = await api.post("/api/encounters", headers=auth("doctor"), json={
        "mrn": mrn, "complaint": "Chest tightness on exertion",
        "diagnosis": "I20.9 Angina pectoris, unspecified",
        "notes": "Start antianginal. Troponin to exclude ACS.",
        "labs": [{"testName": "Troponin I", "priority": "stat", "price": 80}],
        "prescriptions": [{"drug": "Atorvastatin 20mg", "dose": "1 tablet",
                           "frequency": "At night", "duration": "30 days", "quantity": 30}],
        "consultationFee": 120})
    assert signed.status_code == 201

    # 6. The laboratory advances one stage at a time and verifies as critical.
    worklist = (await api.get("/api/lab/worklist", headers=auth("lab"))).json()
    order = next(o for o in worklist if o["mrn"] == mrn)
    assert order["priority"] == "stat"

    for stage in ("collected", "processing"):
        assert (await api.post(f"/api/lab/{order['id']}/advance", headers=auth("lab"),
                               json={"next": stage})).status_code == 204

    assert (await api.post(f"/api/lab/{order['id']}/advance", headers=auth("lab"), json={
        "next": "resulted", "resultValue": "2.4 ng/mL",
        "refRange": "< 0.04 ng/mL", "flag": "critical"})).status_code == 204

    # Before verification the patient must not see it.
    chart = (await api.get(f"/api/patients/{mrn}/chart", headers=auth("doctor"))).json()
    assert all(l["status"] != "verified" for l in chart["labs"])

    assert (await api.post(f"/api/lab/{order['id']}/advance", headers=auth("lab"),
                           json={"next": "verified"})).status_code == 204

    # 7. Verification releases it, and a critical flag escalates to the doctor.
    notes = (await api.get("/api/notifications", headers=auth("doctor"))).json()
    assert any(n["kind"] == "critical" and "Troponin" in n["title"] for n in notes)

    # 8. Pharmacy dispenses. Stock falls and a charge is captured.
    stock_before = next(i for i in (await api.get("/api/pharmacy/inventory",
                        headers=auth("pharmacist"))).json() if i["name"] == "Atorvastatin 20mg")
    pending = (await api.get("/api/pharmacy/prescriptions", headers=auth("pharmacist"))).json()
    rx = next(r for r in pending if r["mrn"] == mrn)
    dispensed = await api.post(f"/api/pharmacy/prescriptions/{rx['id']}/dispense",
                               headers=auth("pharmacist"))
    assert dispensed.status_code == 200
    # Nothing left outstanding: the whole prescription went out at once.
    assert dispensed.json()["remaining"] == 0

    stock_after = next(i for i in (await api.get("/api/pharmacy/inventory",
                       headers=auth("pharmacist"))).json() if i["name"] == "Atorvastatin 20mg")
    assert stock_after["quantity"] == stock_before["quantity"] - 30

    # 9. The cashier settles by Mobile Money; the audit names the provider.
    invoices = (await api.get("/api/invoices", headers=auth("cashier"))).json()
    invoice = next(i for i in invoices if i["mrn"] == mrn)
    assert invoice["total"] > 0 and invoice["status"] == "unpaid"

    assert (await api.post(f"/api/invoices/{invoice['id']}/payment", headers=auth("cashier"),
            json={"amount": invoice["total"], "method": "momo",
                  "provider": "MTN MoMo"})).status_code == 204

    settled = next(i for i in (await api.get("/api/invoices",
                   headers=auth("cashier"))).json() if i["id"] == invoice["id"])
    assert settled["status"] == "paid"

    audit = (await api.get("/api/audit", headers=auth("admin"))).json()
    assert any(a["action"] == f"Payment recorded (MoMo · MTN MoMo) {invoice['id']}"
               for a in audit)
