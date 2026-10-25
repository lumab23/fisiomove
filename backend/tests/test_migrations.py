import json
from pathlib import Path
from uuid import uuid4

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
            "exercise_approval_events",
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
        assert revision == "20261024_0009"
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
            "/health": {"get"},
            "/api/v1/auth/login": {"post"},
            "/api/v1/auth/refresh": {"post"},
            "/api/v1/auth/logout": {"post"},
            "/api/v1/auth/me": {"get"},
            "/api/v1/auth/change-password": {"post"},
            "/api/v1/patients": {"get", "post"},
            "/api/v1/patients/{patient_id}": {"get", "patch"},
            "/api/v1/patients/{patient_id}/access": {"post"},
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


def test_migrations_backfill_scores_and_keep_existing_exercises_pending(
    tmp_path: Path,
) -> None:
    database_url = f"sqlite+pysqlite:///{tmp_path / 'backfill.db'}"
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)
    engine = create_engine(database_url)
    session_id = uuid4().hex
    item_id = str(uuid4())
    try:
        command.upgrade(config, "20261022_0007")
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO exercises "
                    "(id, code, name, instructions, allowed_sides, rule_version, "
                    "supported_parameters, is_active, created_at, updated_at) "
                    "VALUES (:id, 'legacy', 'Legacy', 'Test only', :sides, "
                    "'legacy-v1', :parameters, 1, :created, :created)"
                ),
                {
                    "id": uuid4().hex,
                    "sides": json.dumps(["left"]),
                    "parameters": json.dumps({}),
                    "created": "2026-10-24T12:00:00+00:00",
                },
            )
            connection.execute(
                text(
                    "INSERT INTO session_results "
                    "(id, client_session_id, patient_id, workout_id, "
                    "workout_revision_id, status, started_at, finished_at, "
                    "active_duration_ms, workout_snapshot, items, payload_hash, "
                    "created_at) VALUES (:id, :client, :patient, :workout, "
                    ":revision, 'interrupted', :started, :finished, 1000, "
                    ":snapshot, :items, :hash, :started)"
                ),
                {
                    "id": session_id,
                    "client": uuid4().hex,
                    "patient": uuid4().hex,
                    "workout": uuid4().hex,
                    "revision": uuid4().hex,
                    "started": "2026-10-24T12:00:00+00:00",
                    "finished": "2026-10-24T12:01:00+00:00",
                    "snapshot": json.dumps(
                        {"items": [{"id": item_id, "sets": 2, "repetitions": 3}]}
                    ),
                    "items": json.dumps(
                        [
                            {
                                "workout_item_id": item_id,
                                "completed_repetitions": 2,
                            }
                        ]
                    ),
                    "hash": "a" * 64,
                },
            )

        command.upgrade(config, "head")
        with engine.connect() as connection:
            assert (
                connection.scalar(
                    text("SELECT score FROM session_results WHERE id = :id"),
                    {"id": session_id},
                )
                == 2
            )
            assert (
                connection.scalar(
                    text("SELECT approval_status FROM exercises WHERE code = 'legacy'")
                )
                == "pending"
            )
    finally:
        engine.dispose()
