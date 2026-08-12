"""Render the hospital snapshot as prose for the operations copilot."""

from __future__ import annotations


def format_snapshot(s: dict) -> str:
    wards = ", ".join(f"{w['name']} {w['occupied']}/{w['total']}" for w in s["wards"])
    claims = s["claims"]
    return "\n".join([
        f"Patients registered: {s['patientsTotal']}",
        f"Bed occupancy by ward: {wards}",
        f"Queue waiting: {s['queueWaiting']}; in triage: {s['queueInTriage']}",
        f"Laboratory orders pending: {s['labsPending']}",
        f"Prescriptions pending: {s['rxPending']}",
        f"Revenue collected: GHS {float(s['revenueCollected']):.2f}; "
        f"outstanding: GHS {float(s['revenueOutstanding']):.2f}",
        f"Staff on duty: {s['staffOnDuty']} of {s['staffTotal']}",
        f"Claims — submitted {claims['submitted']}, "
        f"authorised {claims['authorised']}, paid {claims['paid']}",
    ])
