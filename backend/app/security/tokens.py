"""Issuing and reading session tokens."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status

from ..config import get_settings
from .roles import Role


def create_access_token(user_id: uuid.UUID, role: Role) -> tuple[str, int]:
    """Returns the token and its lifetime in seconds."""
    settings = get_settings()
    expires_in = settings.access_token_minutes * 60
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_in


def unauthorised(detail: str = "Not signed in.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def read_subject(token: str) -> uuid.UUID:
    """The user id from a valid token, or a 401 explaining why not."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.ExpiredSignatureError:
        raise unauthorised("Your session has expired. Sign in again.")
    except jwt.InvalidTokenError:
        raise unauthorised("That session token is not valid.")

    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise unauthorised("That session token is not valid.")
