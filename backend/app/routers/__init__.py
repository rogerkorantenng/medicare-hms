from fastapi import APIRouter

from . import auth, patients

router = APIRouter()
for module in (auth, patients):
    router.include_router(module.router)

__all__ = ["router"]
