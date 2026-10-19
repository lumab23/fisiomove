import pytest
from pydantic import ValidationError

from app.core.config import Environment, Settings


def test_database_url_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings(_env_file=None)  # type: ignore[call-arg]


def test_sqlite_is_allowed_only_for_isolated_tests() -> None:
    settings = Settings(
        _env_file=None,
        environment=Environment.TEST,
        database_url="sqlite+pysqlite:///:memory:",
    )

    assert settings.environment is Environment.TEST

    with pytest.raises(ValidationError, match=r"postgresql\+psycopg"):
        Settings(
            _env_file=None,
            environment=Environment.DEVELOPMENT,
            database_url="sqlite+pysqlite:///:memory:",
        )
