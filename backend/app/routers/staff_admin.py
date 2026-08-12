"""
Creating staff accounts and resetting passwords. See staff_edit.py for
changes to an existing record, and staff.py for the read side.

A staff record is never deleted, only deactivated: audit entries, orders,
prescriptions and encounters all reference whoever performed them, and a
hospital that can erase the author of a clinical action does not have an
audit trail.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from ..db import connection, humanise
from ..security import ALL_ROLES, CurrentUser, hash_password, require
from ..serialise import row

router = APIRouter(prefix="/staff", tags=["staff"])

Admin = Annotated[CurrentUser, Depends(require("admin"))]

MIN_PASSWORD = 12
STAFF_ROLES = ALL_ROLES - {"patient"}

# ST-001, ST-002, ... allocated inside the transaction so two
# administrators adding staff at once cannot collide on the number.
_NEXT_STAFF_NO = r"""
    select 'ST-' || lpad((coalesce(max(nullif(
             regexp_replace(staff_no, '\D', '', 'g'), '')::int), 0) + 1)::text, 3, '0')
      from staff
"""


class NewStaff(BaseModel):
    email: EmailStr
    fullName: str = Field(min_length=2, max_length=120)
    role: str
    department: str | None = None
    password: str = Field(min_length=MIN_PASSWORD)


class NewPassword(BaseModel):
    password: str = Field(min_length=MIN_PASSWORD)


def check_role(role: str | None) -> None:
    if role is not None and role not in STAFF_ROLES:
        raise HTTPException(status_code=422, detail=f"'{role}' is not a staff role.")


@router.post("", status_code=201)
async def create_staff(body: NewStaff, user: Admin):
    """Creates the sign-in account and the staff record in one transaction."""
    check_role(body.role)
    async with connection() as conn:
        async with conn.transaction():
            try:
                new_id = await conn.fetchval(
                    """insert into users (email, password_hash, role)
                       values (lower($1), $2, $3::role_enum) returning id""",
                    body.email, hash_password(body.password), body.role)
            except Exception as exc:
                # humanise maps a constraint name onto a status and a
                # message a receptionist could act on; a duplicate email
                # comes back as 409 rather than a 500.
                code, message = humanise(exc)
                raise HTTPException(status_code=code, detail=message) from exc

            staff_no = await conn.fetchval(_NEXT_STAFF_NO)
            record = await conn.fetchrow(
                """insert into staff (id, staff_no, full_name, role, department)
                   values ($1, $2, $3, $4::role_enum, $5)
                   returning id, staff_no, full_name, role::text, department, on_duty""",
                new_id, staff_no, body.fullName, body.role, body.department)
            await conn.execute("select write_audit($1, $2, $3)", user.id,
                               f"Created staff account ({body.role})", body.fullName)
    return row(record)


@router.post("/{staff_id}/password", status_code=204)
async def reset_password(staff_id: str, body: NewPassword, user: Admin):
    """
    Sets a new password for someone who has lost theirs. The administrator
    never sees the old one: only a hash is stored, and this replaces it.
    """
    async with connection() as conn:
        async with conn.transaction():
            member = await conn.fetchrow(
                """select s.full_name from staff s join users u on u.id = s.id
                    where s.id = $1 and u.is_active""", staff_id)
            if member is None:
                raise HTTPException(status_code=404, detail="No such active staff member.")
            await conn.execute("update users set password_hash = $2 where id = $1",
                               staff_id, hash_password(body.password))
            await conn.execute("select write_audit($1, 'Reset password', $2)",
                               user.id, member["full_name"])
