from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root: server/app/core/config.py -> parents[3]
ROOT_DIR = Path(__file__).resolve().parents[3]
ENV_FILE = ROOT_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "MTK Finance"
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"
    VERCEL_ENV: str | None = None

    DATABASE_URL: str
    DIRECT_URL: str | None = None

    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    JWT_SECRET_KEY: str
    JWT_REFRESH_SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    SITE_URL: str = "http://localhost:3000"
    BACKEND_CORS_ORIGINS: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:3001,http://127.0.0.1:3001"
    )

    AUTO_FINALIZE_DAYS: int = 7
    GEMINI_API_KEY: str = ""
    GEMINI_API_KEY2: str = ""
    # See https://ai.google.dev/gemini-api/docs/models — gemini-flash-latest tracks current Flash
    GEMINI_MODEL: str = "gemini-flash-latest"
    GEMINI_MODEL_FALLBACKS: str = "gemini-2.0-flash,gemini-2.0-flash-lite"
    # Global cap protects shared Gemini project quota across all users
    GEMINI_RPM_GLOBAL: int = 12
    GEMINI_RPD_GLOBAL: int = 200
    GEMINI_RPM_PER_USER: int = 8
    GEMINI_RPD_PER_USER: int = 80
    GEMINI_MIN_INTERVAL_SECONDS: int = 6
    GEMINI_MAX_HISTORY_MESSAGES: int = 6
    GEMINI_MAX_OUTPUT_TOKENS: int = 1024
    GEMINI_MAX_RETRIES: int = 2
    GEMINI_RETRY_BASE_SEC: float = 2.0
    GEMINI_KEY_QUOTA_COOLDOWN_SECONDS: int = 3600
    GEMINI_KEY_RATE_LIMIT_COOLDOWN_SECONDS: int = 60
    GEMINI_KEY_AUTH_COOLDOWN_SECONDS: int = 86400
    # Per-model quota cooldown (seconds); lower in dev if you hit false positives after reload
    GEMINI_MODEL_QUOTA_COOLDOWN_SECONDS: int = 300

    EMAIL_INTERNAL_SECRET: str = ""

    MAX_LOGIN_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15

    @field_validator("DATABASE_URL", "DIRECT_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str | None) -> str | None:
        if v is None or not isinstance(v, str):
            return v
        url = v.strip()
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        parsed = urlparse(url)
        if parsed.query:
            params = parse_qs(parsed.query)
            for key in ("pgbouncer",):
                params.pop(key, None)
            query = urlencode({k: vals[0] for k, vals in params.items()})
            parsed = parsed._replace(query=query)
            url = urlunparse(parsed)
        return url

    @property
    def sqlalchemy_database_uri(self) -> str:
        """Prefer DIRECT_URL for migrations; fall back to DATABASE_URL."""
        return self.DIRECT_URL or self.DATABASE_URL

    @property
    def gemini_models(self) -> list[str]:
        """Ordered models: primary first, then fallbacks (deduplicated)."""
        models: list[str] = []
        primary = self.GEMINI_MODEL.strip()
        if primary:
            models.append(primary)
        for part in self.GEMINI_MODEL_FALLBACKS.split(","):
            name = part.strip()
            if name and name not in models:
                models.append(name)
        return models or ["gemini-flash-latest"]

    @property
    def gemini_api_keys(self) -> list[tuple[str, str]]:
        """Ordered API keys: primary first, then fallback."""
        keys: list[tuple[str, str]] = []
        primary = self.GEMINI_API_KEY.strip()
        fallback = self.GEMINI_API_KEY2.strip()
        if primary:
            keys.append(("primary", primary))
        if fallback and fallback != primary:
            keys.append(("fallback", fallback))
        return keys

    @property
    def cors_origins(self) -> list[str]:
        origins = [
            o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()
        ]
        if self.SITE_URL and self.SITE_URL not in origins:
            origins.append(self.SITE_URL)
        return origins


@lru_cache
def get_settings() -> Settings:
    settings = Settings()  # type: ignore[call-arg]
    if settings.VERCEL_ENV == "production":
        settings.ENVIRONMENT = "production"
    elif settings.VERCEL_ENV == "preview":
        settings.ENVIRONMENT = "staging"
    return settings
