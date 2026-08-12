from fastapi import APIRouter

from . import (account, admin, ai_business, ai_clinical, ai_patient, appointments, auth,
               billing, clinical, diagnostics, documents, patients, pharmacy,
               patients_edit, queue, staff, staff_admin, staff_edit, wards)

router = APIRouter()
for module in (auth, account, patients, patients_edit, appointments, queue, clinical, diagnostics,
               pharmacy, wards, billing, documents, staff, staff_admin, staff_edit, admin,
               ai_clinical, ai_patient, ai_business):
    router.include_router(module.router)

__all__ = ["router"]
