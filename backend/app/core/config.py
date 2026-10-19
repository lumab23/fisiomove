from enum import StrEnum
from functools import lru_cache

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """Application settings loaded from environment variables or a local .env."""

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
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
        if len(value.get_secret_value()) < 32:
            raise ValueError("AUTH_SECRET_KEY must contain at least 32 characters")
        return value

    @model_validator(mode="after")
    def validate_environment_database(self) -> "Settings":
        if not self.api_prefix.startswith("/"):
            raise ValueError("API_PREFIX must start with '/'")

        is_postgres = self.database_url.startswith("postgresql+psycopg://")
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
            and self.auth_secret_key.get_secret_value().startswith("replace-")
        ):
            raise ValueError("AUTH_SECRET_KEY placeholder is forbidden in production")
        return self


@lru_cache
def get_settings() -> Settings:
    """Return one validated settings instance per process."""
    return Settings()  # type: ignore[call-arg]
