from concurrent.futures import ThreadPoolExecutor

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from fastapi.testclient import TestClient

from app.core.config import Environment, Settings
from app.db.base import Base
from app.db.migrations import ensure_schema_ready
from app.main import create_app
from scripts import migrate as migrator


def test_concurrent_deployment_migrators_share_a_lock_and_leave_no_schema_drift(
    postgres_url: str, monkeypatch
) -> None:
    settings = Settings(
        _env_file=None,
        environment=Environment.TEST,
        database_url=postgres_url,
        auth_secret_key="deployment-test-only-key-at-least-32-characters",
    )
    monkeypatch.setattr(migrator, "get_settings", lambda: settings)
    app = create_app(settings)
    try:
        with TestClient(app) as client:
            assert client.get("/ready").status_code == 503
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(migrator.migrate) for _ in range(2)]
                for future in futures:
                    future.result(timeout=30)
            assert client.get("/ready").status_code == 200
            ensure_schema_ready(app.state.database.engine)
            with app.state.database.engine.connect() as connection:
                assert (
                    compare_metadata(
                        MigrationContext.configure(connection), Base.metadata
                    )
                    == []
                )
    finally:
        app.state.database.dispose()


def test_production_startup_refuses_unmigrated_database(
    postgres_url: str, monkeypatch
) -> None:
    import pytest

    from app.db.migrations import SchemaNotReadyError

    settings = Settings(
        _env_file=None,
        environment=Environment.PRODUCTION,
        database_url=postgres_url,
        auth_secret_key="production-startup-test-only-secret-key",
    )
    app = create_app(settings)
    with pytest.raises(SchemaNotReadyError):
        with TestClient(app):
            pass
    monkeypatch.setattr(migrator, "get_settings", lambda: settings)
    migrator.migrate()
    with TestClient(app) as client:
        assert client.get("/ready").status_code == 200


def test_pool_applies_utc_timeouts_and_rolls_back_after_timeout(
    postgres_url: str,
) -> None:
    import pytest
    from sqlalchemy import text
    from sqlalchemy.exc import OperationalError

    from app.db.session import Database

    settings = Settings(
        _env_file=None,
        environment=Environment.TEST,
        database_url=postgres_url,
        db_statement_timeout_ms=20,
        db_lock_timeout_ms=250,
    )
    database = Database.from_settings(settings)
    try:
        with database.session() as session:
            assert session.scalar(text("SHOW TIME ZONE")) == "UTC"
            assert session.scalar(text("SHOW lock_timeout")) == "250ms"
        with pytest.raises(OperationalError):
            with database.session() as session:
                session.execute(text("SELECT pg_sleep(0.1)"))
        with database.session() as session:
            assert session.scalar(text("SELECT 1")) == 1
    finally:
        database.dispose()
