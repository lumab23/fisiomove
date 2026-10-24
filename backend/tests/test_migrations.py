from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def test_empty_database_migrates_to_head(tmp_path: Path) -> None:
    database_path = tmp_path / "migration.db"
    database_url = f"sqlite+pysqlite:///{database_path}"
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)

    engine = create_engine(database_url)
    try:
        command.upgrade(config, "20261019_0001")
        assert inspect(engine).get_table_names() == ["alembic_version"]

        command.upgrade(config, "head")
        assert inspect(engine).get_table_names() == [
            "achievements",
            "alembic_version",
            "exercises",
            "notes",
            "patients",
            "professional_patient_links",
            "refresh_tokens",
            "session_results",
            "users",
            "workout_items",
            "workout_revisions",
            "workouts",
        ]
        with engine.connect() as connection:
            revision = connection.scalar(
                text("SELECT version_num FROM alembic_version")
            )
        assert revision == "20261022_0007"
        with engine.connect() as connection:
            from alembic.autogenerate import compare_metadata
            from alembic.migration import MigrationContext

            from app.db.base import Base

            assert (
                compare_metadata(MigrationContext.configure(connection), Base.metadata)
                == []
            )
        command.downgrade(config, "20261019_0003")
        assert inspect(engine).get_table_names() == [
            "alembic_version",
            "patients",
            "professional_patient_links",
            "refresh_tokens",
            "users",
        ]
        command.upgrade(config, "head")
    finally:
        engine.dispose()


def test_business_routes_registered_once() -> None:
    from app.core.config import Environment, Settings
    from app.main import create_app

    application = create_app(
        Settings(
            _env_file=None,
            environment=Environment.TEST,
            database_url="sqlite+pysqlite:///:memory:",
            auth_secret_key="tests-only-secret-key-with-at-least-32-characters",
        )
    )
    try:
        paths = application.openapi()["paths"]
        expected = {
            "/api/v1/exercises": {"get"},
            "/api/v1/exercises/{exercise_id}": {"get"},
            "/api/v1/patients/{patient_id}/workouts": {"get", "post"},
            "/api/v1/workouts/{workout_id}": {"get", "patch"},
            "/api/v1/workouts/{workout_id}/publish": {"post"},
            "/api/v1/workouts/{workout_id}/archive": {"post"},
            "/api/v1/me/workouts": {"get"},
            "/api/v1/patients/{patient_id}/notes": {"get", "post"},
            "/api/v1/notes/{note_id}": {"patch"},
            "/api/v1/me/sessions": {"get", "post"},
            "/api/v1/me/sessions/{session_id}": {"get"},
            "/api/v1/patients/{patient_id}/sessions": {"get"},
            "/api/v1/patients/{patient_id}/sessions/{session_id}": {"get"},
            "/api/v1/me/progress": {"get"},
            "/api/v1/patients/{patient_id}/progress": {"get"},
            "/api/v1/me/achievements": {"get"},
            "/api/v1/patients/{patient_id}/achievements": {"get"},
        }
        for path, methods in expected.items():
            assert set(paths[path]) == methods
        # OpenAPI generation also checks operation IDs for duplicated registrations.
        ids = [
            operation["operationId"]
            for path in paths.values()
            for operation in path.values()
        ]
        assert len(ids) == len(set(ids))
    finally:
        application.state.database.dispose()
