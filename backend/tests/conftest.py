"""
Shared fixtures. Tests run against a real PostgreSQL — the constraints and
triggers ARE the behaviour under test, so mocking the database would test
nothing that matters.

    docker compose up -d db
    DEMO_PASSWORD='MediCare2026!Demo' uv run pytest
"""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("AI_PROVIDER", "none")  # never call a model in tests

from app.db import close_pool, init_pool  # noqa: E402
from app.main import app  # noqa: E402

PASSWORD = os.environ.get("DEMO_PASSWORD", "MediCare2026!Demo")

ACCOUNTS = {
    "doctor": "doctor@medicare.com",
    "nurse": "nurse@medicare.com",
    "receptionist": "reception@medicare.com",
    "lab": "lab@medicare.com",
    "radiology": "radiology@medicare.com",
    "pharmacist": "pharmacy@medicare.com",
    "cashier": "cashier@medicare.com",
    "admin": "admin@medicare.com",
    "patient": "patient@medicare.com",
}


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def api():
    await init_pool()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await close_pool()


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def tokens(api) -> dict[str, str]:
    """One bearer token per role, signed in once for the whole session."""
    out: dict[str, str] = {}
    for role, email in ACCOUNTS.items():
        response = await api.post(
            "/api/auth/login", json={"email": email, "password": PASSWORD}
        )
        assert response.status_code == 200, f"{role} could not sign in: {response.text}"
        out[role] = response.json()["access_token"]
    return out


@pytest.fixture
def auth(tokens):
    """auth('cashier') -> headers for that role."""
    def _headers(role: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {tokens[role]}"}
    return _headers


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def admin_id(api, tokens) -> str:
    """
    The signed-in administrator's own id, for the tests that check an
    administrator cannot lock themselves out.
    """
    response = await api.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {tokens['admin']}"}
    )
    return response.json()["id"]
