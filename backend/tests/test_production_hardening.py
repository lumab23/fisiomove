import json
import logging
from typing import Annotated

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.config import Environment, Settings
from app.core.observability import JsonFormatter
from app.db.session import get_db_session


@pytest.mark.parametrize("flag", ["debug", "db_echo"])
def test_production_rejects_debug_and_sql_echo(flag: str) -> None:
    with pytest.raises(ValidationError, match="must be false"):
        Settings(
            _env_file=None,
            environment=Environment.PRODUCTION,
            database_url="postgresql+psycopg://user@localhost/db",
            auth_secret_key="production-test-only-not-a-real-secret-key",
            **{flag: True},
        )


def test_readiness_requires_migrations(application, client) -> None:
    assert client.get("/ready").json() == {"status": "ready"}
    with application.state.database.engine.begin() as connection:
        connection.execute(text("DELETE FROM alembic_version"))
    response = client.get("/ready")
    assert response.status_code == 503
    assert response.json()["code"] == "database_not_ready"
    assert response.headers["retry-after"] == "1"
    assert client.get("/health").status_code == 200


def test_commit_failure_is_not_reported_as_success(application, monkeypatch) -> None:
    @application.post("/commit-probe", status_code=201)
    def commit_probe(
        session: Annotated[Session, Depends(get_db_session, scope="function")],
    ) -> dict[str, bool]:
        session.execute(text("SELECT 1"))
        return {"saved": True}

    def failed_commit(self: Session) -> None:
        raise OperationalError("commit", {}, Exception("credential-must-not-leak"))

    monkeypatch.setattr(Session, "commit", failed_commit)
    with TestClient(application, raise_server_exceptions=False) as client:
        response = client.post("/commit-probe")
    assert response.status_code == 503
    assert response.json()["code"] == "database_unavailable"
    assert "credential-must-not-leak" not in response.text


def test_metadata_and_error_logs_do_not_include_credentials(application) -> None:
    @application.get("/unexpected")
    def unexpected() -> None:
        raise RuntimeError("private-database-password")

    with TestClient(application) as client:
        ok = client.get("/health", headers={"X-Request-ID": "untrusted-value"})
        error = client.get("/unexpected")
    assert len(ok.headers["x-request-id"]) == 32
    assert ok.headers["x-request-id"] != "untrusted-value"
    assert ok.headers["cache-control"] == "no-store"
    assert error.status_code == 500
    assert len(error.headers["x-request-id"]) == 32
    assert "private-database-password" not in error.text
    record = logging.LogRecord(
        "fisiomove", logging.ERROR, __file__, 1, "unhandled_exception", (), None
    )
    record.error_type = "RuntimeError"
    record.password = "never-print-this"
    parsed = json.loads(JsonFormatter().format(record))
    assert parsed["error_type"] == "RuntimeError"
    assert "password" not in parsed
