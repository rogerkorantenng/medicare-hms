"""
The prescription safety check and the triage acuity suggestion.

Both are deterministic and neither is AI. The handoff is explicit about
why: "A safety block must be reproducible." The same patient and the same
drug must give the same answer every time, and a pharmacist must be able
to see why.

There is deliberately no override. A blocked prescription cannot be forced
through from a screen — the submitted user manual states that a clinician
who judges the drug necessary despite the conflict arranges it with the
pharmacist directly.

Ported from lib/repository/safety.ts unchanged in behaviour.
"""

from __future__ import annotations

import re
from typing import Literal, TypedDict

ALLERGY_CLASSES: dict[str, list[str]] = {
    "Penicillin": ["Amoxicillin", "Penicillin", "Ampicillin", "Flucloxacillin"],
    "Sulfa": ["Sulfamethoxazole", "Co-trimoxazole"],
    "NSAID": ["Ibuprofen", "Diclofenac", "Naproxen"],
}

NSAIDS = ["Ibuprofen", "Diclofenac", "Naproxen", "Aspirin", "Indometacin"]
ANTICOAGULANTS = ["Warfarin", "Apixaban", "Rivaroxaban", "Dabigatran", "Heparin"]
RAAS_AGENTS = [
    "Lisinopril", "Enalapril", "Ramipril", "Perindopril", "Captopril",
    "Losartan", "Valsartan", "Candesartan", "Irbesartan", "Telmisartan",
]

_STRENGTH = re.compile(r"\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|units?)\b", re.I)
_FORM = re.compile(
    r"\b(tablet|tab|capsule|cap|inj|injection|inhaler|sachets?|syrup|cream|drops)\b", re.I
)


class SafetyResult(TypedDict, total=False):
    ok: bool
    kind: Literal["allergy", "interaction"]
    message: str


def active_ingredient(drug: str) -> str:
    """"Amoxicillin 500mg" and "Amoxicillin" are the same ingredient."""
    out = _FORM.sub("", _STRENGTH.sub("", drug))
    return re.sub(r"\s+", " ", out).strip()


def _is_in(drug: str, names: list[str]) -> bool:
    ingredient = active_ingredient(drug).lower()
    return any(name.lower() in ingredient for name in names)


def check_safety(
    patient_name: str, allergies: list[str], active: list[str], drug: str
) -> SafetyResult:
    """Allergy first, then interactions, then duplicate therapy."""
    proposed = active_ingredient(drug)

    for allergen in allergies:
        members = ALLERGY_CLASSES.get(allergen)
        hit = _is_in(drug, members) if members else allergen.lower() in proposed.lower()
        if hit:
            return {
                "ok": False, "kind": "allergy",
                "message": (f"ALLERGY ALERT — {patient_name} is allergic to {allergen}. "
                            f"{drug} is contraindicated."),
            }

    adding_nsaid = _is_in(drug, NSAIDS)
    adding_anticoag = _is_in(drug, ANTICOAGULANTS)
    on_nsaid = any(_is_in(d, NSAIDS) for d in active)
    on_anticoag = any(_is_in(d, ANTICOAGULANTS) for d in active)

    if (adding_nsaid and on_anticoag) or (adding_anticoag and on_nsaid):
        return {"ok": False, "kind": "interaction",
                "message": "INTERACTION — Major bleed risk. NSAID with anticoagulant."}

    if _is_in(drug, RAAS_AGENTS) and any(_is_in(d, RAAS_AGENTS) for d in active):
        return {"ok": False, "kind": "interaction",
                "message": ("INTERACTION — Two RAAS agents. Risk of hyperkalaemia "
                            "and hypotension.")}

    if any(active_ingredient(d).lower() == proposed.lower() for d in active):
        return {"ok": False, "kind": "interaction", "message": "INTERACTION — Duplicate therapy."}

    return {"ok": True}
