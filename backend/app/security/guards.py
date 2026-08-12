"""The guards themselves. See deps.py for why these carry the weight."""

from __future__ import annotations

from fastapi import HTTPException, status

from .deps import CurrentUser, CurrentUserDep
from .roles import ALL_ROLES, Role

_FORBIDDEN = "Your role does not permit that action."


def require(*roles: Role):
    """
    Dependency factory. Every route carries one.

        @router.get("/", dependencies=[Depends(require(*CLINICAL_ROLES))])

    Passing no roles means any signed-in user, which is rare and should
    always be paired with `scope_to_patient` when the data belongs to
    somebody in particular.
    """
    allowed = set(roles) if roles else set(ALL_ROLES)
    unknown = allowed - ALL_ROLES
    if unknown:
        raise ValueError(f"Unknown role(s) in guard: {sorted(unknown)}")

    async def guard(user: CurrentUserDep) -> CurrentUser:
        if user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN)
        return user

    return guard


def scope_to_patient(user: CurrentUser, mrn: str) -> None:
    """
    A patient may only ever reach their own record.

    This is the check row-level security used to make for us. Call it on
    every route that takes an MRN and is reachable by a patient. Staff
    pass through; a patient whose own MRN does not match is refused with
    the same 403 as any other role violation, so the API never reveals
    whether that MRN exists.
    """
    if user.role != "patient":
        return
    if user.mrn is None or user.mrn != mrn:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN)


def require_own_mrn(user: CurrentUser) -> str:
    """The signed-in patient's own MRN, or a clear error."""
    if user.role != "patient" or not user.mrn:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is for patient accounts.",
        )
    return user.mrn
