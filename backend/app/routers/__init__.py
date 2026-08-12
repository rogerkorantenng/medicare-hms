from fastapi import APIRouter

from . import (admin, ai_business, ai_clinical, ai_patient, appointments, auth,
               billing, clinical, diagnostics, documents, patients, pharmacy,
               queue, staff, wards)

router = APIRouter()
for module in (auth, patients, appointments, queue, clinical, diagnostics,
               pharmacy, wards, billing, documents, staff, admin,
               ai_clinical, ai_patient, ai_business):
    router.include_router(module.router)

__all__ = ["router"]
