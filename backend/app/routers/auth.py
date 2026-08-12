from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from ..db import connection
from ..security import (
    CurrentUser,
    CurrentUserDep,
    create_access_token,
    hash_password,
    needs_rehash,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: CurrentUser


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest) -> LoginResponse:
    """
    The only unauthenticated route that touches data.

    The same message comes back whether the email is unknown or the
    password is wrong, so this cannot be used to discover which
    accounts exist.
    """
    email = body.email.strip().lower()

    async with connection() as conn:
        row = await conn.fetchrow(
            """
            select u.id, u.email, u.password_hash, u.role::text as role, u.is_active,
                   s.full_name as staff_name, s.staff_no, s.department,
                   p.mrn, p.full_name as patient_name
              from users u
              left join staff s on s.id = u.id
              left join patients p on p.user_id = u.id
             where lower(u.email) = $1
            """,
            email,
        )

        invalid = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="That email and password do not match an account.",
        )

        if row is None or not row["is_active"]:
            raise invalid
        if not verify_password(body.password, row["password_hash"]):
            raise invalid

        # Argon2 parameters move over time; take the opportunity.
        if needs_rehash(row["password_hash"]):
            await conn.execute(
                "update users set password_hash = $2 where id = $1",
                row["id"],
                hash_password(body.password),
            )

    token, expires_in = create_access_token(row["id"], row["role"])

    return LoginResponse(
        access_token=token,
        expires_in=expires_in,
        user=CurrentUser(
            id=row["id"],
            email=row["email"],
            role=row["role"],
            full_name=row["staff_name"] or row["patient_name"] or row["email"],
            staff_no=row["staff_no"],
            department=row["department"],
            mrn=row["mrn"],
        ),
    )


@router.get("/me", response_model=CurrentUser)
async def me(user: CurrentUserDep) -> CurrentUser:
    """Who the bearer token belongs to. The frontend calls this on load."""
    return user
