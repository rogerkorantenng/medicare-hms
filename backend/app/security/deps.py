"""
THE AUTHORISATION BOUNDARY.

In the Supabase version these rules lived in PostgreSQL row-level
security, so the database itself refused a cashier reading a
consultation note. That enforcement point was moved here by an explicit
design decision.

The consequence is worth stating plainly: the database will now hand any
row to anyone who asks. Every restriction that matters is a guard on a
route in this application, so a missing guard is a data leak rather than
a bug. Two rules follow:

  1. Every route carries `require(...)`. Nothing is public except
     /auth/login and /health.
  2. Anything scoped to one patient calls `scope_to_patient`, which is
     what stops a signed-in patient reading someone else's record by
     changing the MRN in the URL.

tests/test_authorisation.py exercises both, role by role.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from ..db import connection
from .roles import ALL_ROLES, CLINICAL_ROLES, Role, STAFF_ROLES
from .tokens import read_subject, unauthorised

_bearer = HTTPBearer(auto_error=False)

_LOOKUP = """
    select u.id, u.email, u.role::text as role, u.is_active,
           s.full_name as staff_name, s.staff_no, s.department,
           p.mrn, p.full_name as patient_name
      from users u
      left join staff s on s.id = u.id
      left join patients p on p.user_id = u.id
     where u.id = $1
"""


class CurrentUser(BaseModel):
    id: uuid.UUID
    email: str
    role: Role
    full_name: str
    staff_no: str | None = None
    department: str | None = None
    mrn: str | None = None

    @property
    def is_staff(self) -> bool:
        return self.role in STAFF_ROLES

    @property
    def is_clinical(self) -> bool:
        return self.role in CLINICAL_ROLES


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser:
    if creds is None:
        raise unauthorised()

    user_id = read_subject(creds.credentials)

    # The role is read from the database rather than trusted from the
    # token, so revoking or changing one takes effect on the next
    # request instead of whenever the token happens to expire.
    async with connection() as conn:
        row = await conn.fetchrow(_LOOKUP, user_id)

    if row is None or not row["is_active"]:
        raise unauthorised("That account is no longer active.")

    return CurrentUser(
        id=row["id"],
        email=row["email"],
        role=row["role"],
        full_name=row["staff_name"] or row["patient_name"] or row["email"],
        staff_no=row["staff_no"],
        department=row["department"],
        mrn=row["mrn"],
    )


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
