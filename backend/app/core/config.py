from enum import StrEnum
from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


class Environment(StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """Application settings loaded from environment variables or a local .env."""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
        case_sensitive=True,
    )

    app_name: str = Field(default="FisioMove API", validation_alias="APP_NAME")
    environment: Environment = Field(
        default=Environment.DEVELOPMENT,
        validation_alias="APP_ENV",
    )
    debug: bool = Field(default=False, validation_alias="APP_DEBUG")
    api_prefix: str = Field(default="/api/v1", validation_alias="API_PREFIX")
    database_url: str = Field(
        min_length=1,
        repr=False,
        validation_alias="DATABASE_URL",
    )
    db_echo: bool = Field(default=False, validation_alias="DB_ECHO")
    db_pool_size: int = Field(default=5, ge=1, le=100, validation_alias="DB_POOL_SIZE")
    db_max_overflow: int = Field(
        default=10, ge=0, le=100, validation_alias="DB_MAX_OVERFLOW"
    )
    db_pool_timeout_seconds: int = Field(
        default=30, ge=1, le=300, validation_alias="DB_POOL_TIMEOUT_SECONDS"
    )
    db_pool_recycle_seconds: int = Field(
        default=1800, ge=1, validation_alias="DB_POOL_RECYCLE_SECONDS"
    )
    db_connect_timeout_seconds: int = Field(
        default=10, ge=1, le=60, validation_alias="DB_CONNECT_TIMEOUT_SECONDS"
    )
    db_statement_timeout_ms: int = Field(
        default=30000, ge=1, validation_alias="DB_STATEMENT_TIMEOUT_MS"
    )
    db_lock_timeout_ms: int = Field(
        default=10000, ge=1, validation_alias="DB_LOCK_TIMEOUT_MS"
    )
    auth_secret_key: SecretStr = Field(validation_alias="AUTH_SECRET_KEY")
    auth_access_token_minutes: int = Field(
        default=15,
        ge=1,
        le=1440,
        validation_alias="AUTH_ACCESS_TOKEN_MINUTES",
    )
    auth_refresh_token_days: int = Field(
        default=30,
        ge=1,
        le=90,
        validation_alias="AUTH_REFRESH_TOKEN_DAYS",
    )
    auth_issuer: str = Field(
        default="fisiomove-api",
        min_length=1,
        validation_alias="AUTH_ISSUER",
    )
    auth_audience: str = Field(
        default="fisiomove-mobile",
        min_length=1,
        validation_alias="AUTH_AUDIENCE",
    )

    @field_validator("auth_secret_key")
    @classmethod
    def validate_auth_secret_key(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value().strip()) < 32:
            raise ValueError("AUTH_SECRET_KEY must contain at least 32 characters")
        return value

    @model_validator(mode="after")
    def validate_environment_database(self) -> "Settings":
        if not self.api_prefix.startswith("/"):
            raise ValueError("API_PREFIX must start with '/'")

        try:
            url = make_url(self.database_url)
        except (ArgumentError, ValueError) as exc:
            raise ValueError("DATABASE_URL is not a valid database URL") from exc
        is_postgres = url.drivername == "postgresql+psycopg"
        if is_postgres and (not url.host or not url.database):
            raise ValueError("PostgreSQL DATABASE_URL requires a host and database")
        is_test_sqlite = (
            self.environment is Environment.TEST
            and self.database_url.startswith("sqlite+pysqlite://")
        )
        if not (is_postgres or is_test_sqlite):
            raise ValueError(
                "DATABASE_URL must use postgresql+psycopg; "
                "sqlite+pysqlite is allowed only when APP_ENV=test"
            )
        if (
            self.environment is Environment.PRODUCTION
            and self.auth_secret_key.get_secret_value()
            .strip()
            .lower()
            .startswith("replace-")
        ):
            raise ValueError("AUTH_SECRET_KEY placeholder is forbidden in production")
        if self.environment is Environment.PRODUCTION and (self.debug or self.db_echo):
            raise ValueError("APP_DEBUG and DB_ECHO must be false in production")
        return self


@lru_cache
def get_settings() -> Settings:
    """Return one validated settings instance per process."""
    try:
        return Settings()  # type: ignore[call-arg]
    except ValidationError as exc:
        fields = sorted(
            {
                str(error["loc"][0]) if error["loc"] else "environment"
                for error in exc.errors()
            }
        )
        raise RuntimeError(
            f"Invalid configuration fields: {', '.join(fields)}"
        ) from None
