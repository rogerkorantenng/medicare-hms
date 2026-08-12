from fastapi import APIRouter

from . import (admin, ai_clinical, ai_other, appointments, auth, billing,
               clinical, diagnostics, patients, pharmacy, queue, wards)

router = APIRouter()
for module in (auth, patients, appointments, queue, clinical, diagnostics,
               pharmacy, wards, billing, admin, ai_clinical, ai_other):
    router.include_router(module.router)

__all__ = ["router"]
