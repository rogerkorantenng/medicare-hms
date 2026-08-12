from fastapi import APIRouter

from . import (account, account_prefs, admin, ai_business, ai_clinical, ai_patient,
               appointments, appointments_edit, auth, billing, billing_edit, catalogue,
               clinical, clinical_edit, diagnostics, documents, operations, patients,
               patients_edit, pharmacy, queue, records, rosters, staff, staff_admin,
               staff_edit, stock, wards, wards_admin)

# Order matters only where a literal path could be shadowed by a
# parameterised one; the specific router goes first in those cases.
MODULES = (
    auth, account, account_prefs,
    patients, patients_edit, operations,
    appointments, appointments_edit, rosters,
    queue, clinical, clinical_edit, records,
    diagnostics, pharmacy, stock,
    wards, wards_admin,
    billing, billing_edit,
    documents, catalogue,
    staff, staff_admin, staff_edit,
    admin,
    ai_clinical, ai_patient, ai_business,
)

router = APIRouter()
for module in MODULES:
    router.include_router(module.router)

__all__ = ["router"]
