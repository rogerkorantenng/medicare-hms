"""
The triage acuity suggestion.

Deterministic, never AI, for the same reason as the prescription safety
check: a nurse must be able to see why it said what it said. It suggests;
the nurse sets the value.
"""

from __future__ import annotations

from typing import Literal, TypedDict

Acuity = Literal["routine", "semi_urgent", "urgent"]


class Suggestion(TypedDict):
    acuity: Acuity
    reasons: list[str]


def suggest_acuity(
    systolic: int | None = None, diastolic: int | None = None,
    temperature: float | None = None, pulse: int | None = None,
    spo2: int | None = None,
) -> Suggestion:
    reasons: list[str] = []
    score = 0

    if spo2 is not None:
        if spo2 < 92:
            score += 2; reasons.append(f"SpO₂ {spo2}% is below 92%")
        elif spo2 < 95:
            score += 1; reasons.append(f"SpO₂ {spo2}% is below 95%")

    if systolic is not None:
        if systolic >= 180 or systolic < 90:
            score += 2; reasons.append(f"Systolic {systolic} mmHg")
        elif systolic >= 160:
            score += 1; reasons.append(f"Systolic {systolic} mmHg")

    if diastolic is not None and diastolic >= 110:
        score += 1; reasons.append(f"Diastolic {diastolic} mmHg")

    if pulse is not None:
        if pulse > 130 or pulse < 45:
            score += 2; reasons.append(f"Pulse {pulse} bpm")
        elif pulse > 110:
            score += 1; reasons.append(f"Pulse {pulse} bpm")

    if temperature is not None:
        if temperature >= 39.5:
            score += 2; reasons.append(f"Temperature {temperature} °C")
        elif temperature >= 38:
            score += 1; reasons.append(f"Temperature {temperature} °C")

    acuity: Acuity = "urgent" if score >= 3 else "semi_urgent" if score >= 1 else "routine"
    if not reasons:
        reasons.append("All recorded observations are within normal limits")
    return {"acuity": acuity, "reasons": reasons}
