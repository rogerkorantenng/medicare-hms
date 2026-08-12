from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import close_pool, humanise, init_pool
from .routers import router as api_router

DESCRIPTION = """
The MediCare+ Hospital Management System API.

Covers the full patient journey across nine roles: registration,
appointments, triage, consultation, laboratory and imaging orders,
pharmacy dispensing, ward management, billing, insurance claims and
administration.

All data is synthetic. No real patient data appears anywhere.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    yield
    await close_pool()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="MediCare+ HMS API",
        description=DESCRIPTION,
        version="2.0.0",
        lifespan=lifespan,
        # The interactive docs are useful for an examiner, and expose
        # nothing: every route below /api requires a bearer token.
        docs_url="/docs",
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(asyncpg.PostgresError)
    async def postgres_error_handler(_: Request, exc: asyncpg.PostgresError):
        """
        The constraints are the point of this schema, so when one fires
        the caller should get the rule in plain words rather than an
        index name and a 500.
        """
        status_code, message = humanise(exc)
        return JSONResponse(status_code=status_code, content={"detail": message})

    @app.get("/health", tags=["meta"])
    async def health():
        return {"status": "ok", "version": "2.0.0"}

    app.include_router(api_router, prefix="/api")
    return app


app = create_app()
