"""
Changing an existing staff record: name, department, duty, role, and
whether the account may sign in at all.

An administrator cannot deactivate or demote themselves. It is the
ordinary way an organisation ends up with no administrator, and the check
costs one line.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..db import connection
from ..security import CurrentUser, require
from .staff_admin import check_role

router = APIRouter(prefix="/staff", tags=["staff"])

Admin = Annotated[CurrentUser, Depends(require("admin"))]


class StaffPatch(BaseModel):
    fullName: str | None = Field(default=None, min_length=2, max_length=120)
    role: str | None = None
    department: str | None = None
    onDuty: bool | None = None
    isActive: bool | None = None


def describe(body: StaffPatch) -> str:
    """The audit line says what changed, not merely that something did."""
    parts = []
    if body.isActive is not None:
        parts.append("Reactivated staff account" if body.isActive
                     else "Deactivated staff account")
    if body.role is not None:
        parts.append(f"Changed role to {body.role}")
    if body.department is not None:
        parts.append(f"Moved to {body.department}")
    if body.onDuty is not None:
        parts.append("Marked on duty" if body.onDuty else "Marked off duty")
    if body.fullName is not None:
        parts.append("Corrected name")
    return "; ".join(parts) or "Updated staff record"


@router.patch("/{staff_id}", status_code=204)
async def update_staff(staff_id: str, body: StaffPatch, user: Admin):
    check_role(body.role)
    if (body.role is not None or body.isActive is False) and str(user.id) == str(staff_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot change the role of, or deactivate, your own account.")

    async with connection() as conn:
        async with conn.transaction():
            current = await conn.fetchrow(
                "select full_name from staff where id = $1", staff_id)
            if current is None:
                raise HTTPException(status_code=404, detail="No such staff member.")

            if body.fullName is not None:
                await conn.execute("update staff set full_name = $2 where id = $1",
                                   staff_id, body.fullName)
            if body.department is not None:
                await conn.execute("update staff set department = $2 where id = $1",
                                   staff_id, body.department)
            if body.onDuty is not None:
                await conn.execute("update staff set on_duty = $2 where id = $1",
                                   staff_id, body.onDuty)
            if body.role is not None:
                # Both tables carry the role; they must not drift apart.
                await conn.execute("update staff set role = $2::role_enum where id = $1",
                                   staff_id, body.role)
                await conn.execute("update users set role = $2::role_enum where id = $1",
                                   staff_id, body.role)
            if body.isActive is not None:
                # Deactivating clears the password, so the account cannot be
                # signed into even if it is reactivated by mistake.
                await conn.execute(
                    """update users set is_active = $2,
                              password_hash = case when $2 then password_hash else null end
                        where id = $1""", staff_id, body.isActive)
                if not body.isActive:
                    await conn.execute("update staff set on_duty = false where id = $1",
                                       staff_id)

            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               describe(body), current["full_name"])
