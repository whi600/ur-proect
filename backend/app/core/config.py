from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    """Server-only settings loaded from backend/.env or process environment."""

    app_name: str = "ПравоОрбита API"
    app_version: str = "0.1.0"
    app_environment: Literal["development", "test", "production"] = "development"
    data_mode: Literal["demo", "postgres"] = "demo"
    database_url: str | None = None
    source_snapshot_path: Path = (
        PROJECT_DIR / "mobile" / "assets" / "legal" / "ru-core-snapshot-2026-09-25.db"
    )
    ai_provider: Literal["demo", "future"] = "demo"
    ai_api_key: SecretStr | None = None

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        env_prefix="APP_",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_database_settings(self) -> Settings:
        if self.data_mode == "postgres" and not self.database_url:
            raise ValueError("APP_DATABASE_URL is required when APP_DATA_MODE=postgres")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
