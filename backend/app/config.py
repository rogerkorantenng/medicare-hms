from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Everything the API needs, from the environment.

    On AWS these come from App Runner's configured environment variables,
    sourced from Secrets Manager. Locally they come from backend/.env,
    which is gitignored.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ---- database ----
    database_url: str = "postgresql://medicare:medicare@localhost:5432/medicare"
    db_pool_min: int = 2
    db_pool_max: int = 10

    # ---- auth ----
    # Must be set in production. The API refuses to start on the default.
    jwt_secret: str = "dev-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 12

    # ---- AI ----
    # Absent is a supported state: every AI feature returns its documented
    # fallback message and the clinical workflow continues manually.
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-5"

    # ---- CORS ----
    # The Vercel origin, plus local development. Comma-separated.
    cors_origins: str = "http://localhost:3000"

    environment: str = "development"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.is_production and settings.jwt_secret == "dev-only-change-me":
        raise RuntimeError(
            "JWT_SECRET is still the development default. Set a real one before "
            "running in production — every session token is signed with it."
        )
    return settings
