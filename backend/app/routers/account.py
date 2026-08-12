"""
Your own account.

Until now a password could only be set by an administrator, which meant
anyone handed a temporary password was stuck with it, and a person who
suspected theirs was known had no way to change it without asking someone
else. Both are ordinary things people need to do themselves.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..db import connection
from ..security import (
    CurrentUser,
    hash_password,
    require,
    verify_password,
)

router = APIRouter(prefix="/account", tags=["account"])

AnyUser = Annotated[CurrentUser, Depends(require())]

MIN_PASSWORD = 12


class PasswordChange(BaseModel):
    currentPassword: str
    newPassword: str = Field(min_length=MIN_PASSWORD)


@router.post("/password", status_code=204)
async def change_own_password(body: PasswordChange, user: AnyUser):
    """
    The current password is required even though the caller is already
    authenticated. A session left open on a ward computer is the realistic
    threat, and asking for the old password is what stops a passer-by from
    locking the owner out of their own account.
    """
    if body.newPassword == body.currentPassword:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The new password must be different from the current one.",
        )

    async with connection() as conn:
        stored = await conn.fetchval(
            "select password_hash from users where id = $1 and is_active", user.id)
        if stored is None or not verify_password(body.currentPassword, stored):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="That is not your current password.",
            )
        await conn.execute(
            """update users set password_hash = $2, must_change_password = false
                where id = $1""",
            user.id, hash_password(body.newPassword))
        # The target is the actor: an administrator reading the trail can
        # tell a self-service change from one they performed for somebody.
        await conn.execute(
            "select write_audit($1, 'Changed own password', null)", user.id)
