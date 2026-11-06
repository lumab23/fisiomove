import json
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROVENANCE_COLUMNS = {"source", "source_external_id", "source_url", "source_license"}
LOCALIZATION_COLUMNS = {
    "name_pt_br",
    "instructions_pt_br",
    "translated_by_id",
    "translated_at",
}


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
            "alembic_version",
            "exercise_approval_events",
            "exercise_images",
            "exercises",
            "notes",
            "patients",
            "physiotherapist_profiles",
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
        assert revision == "20261106_0014"
        with engine.connect() as connection:
            from alembic.autogenerate import compare_metadata
            from alembic.migration import MigrationContext

            from app.db.base import Base

            assert (
                compare_metadata(MigrationContext.configure(connection), Base.metadata)
                == []
            )
        exercises = inspect(engine)
        assert PROVENANCE_COLUMNS <= {
            column["name"] for column in exercises.get_columns("exercises")
        }
        assert {
            check["name"] for check in exercises.get_check_constraints("exercises")
        } == {
            "ck_exercises_approval_status",
            "ck_exercises_approved_evidence",
            "ck_exercises_provenance_complete",
            "ck_exercises_localization_complete",
        }
        assert LOCALIZATION_COLUMNS <= {
            column["name"] for column in exercises.get_columns("exercises")
        }

        command.downgrade(config, "20261106_0010")
        downgraded = inspect(engine)
        assert "achievements" in downgraded.get_table_names()
        assert not PROVENANCE_COLUMNS & {
            column["name"] for column in downgraded.get_columns("exercises")
        }
        assert {
            check["name"] for check in downgraded.get_check_constraints("exercises")
        } == {"ck_exercises_approval_status", "ck_exercises_approved_evidence"}
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM achievements")) == 0
        command.upgrade(config, "head")
        assert "achievements" not in inspect(engine).get_table_names()
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
            "/api/v1/me/profile": {"get"},
            "/api/v1/me/physiotherapist-profile": {"get", "put"},
            "/api/v1/me/physiotherapist": {"get"},
            "/api/v1/exercises": {"get"},
            "/api/v1/exercises/{exercise_id}": {"get"},
            "/api/v1/exercises/{exercise_id}/images/{position}": {"get"},
            "/api/v1/exercises/{exercise_id}/localization": {"put"},
            "/api/v1/exercise-library": {"get"},
            "/api/v1/exercise-library/{external_id}": {"get"},
            "/api/v1/exercise-library/{external_id}/catalog": {"post"},
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
        }
        for path, methods in expected.items():
            assert set(paths[path]) == methods
        assert not [path for path in paths if "achievement" in path]
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


def test_image_and_localization_migrations_keep_existing_exercises(
    tmp_path: Path,
) -> None:
    """0013/0014 add only empty structures; downgrade keeps the exercise rows."""
    database_url = f"sqlite+pysqlite:///{tmp_path / 'localization.db'}"
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)
    engine = create_engine(database_url)
    exercise_id = uuid4().hex
    try:
        command.upgrade(config, "20261106_0012")
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO exercises "
                    "(id, code, name, instructions, allowed_sides, rule_version, "
                    "supported_parameters, is_active, approval_status, created_at, "
                    "updated_at) VALUES (:id, 'fictional', 'Test only', "
                    "'1. Not a clinical exercise', :sides, 'test-v1', :parameters, "
                    "1, 'pending', :created, :created)"
                ),
                {
                    "id": exercise_id,
                    "sides": json.dumps(["left"]),
                    "parameters": json.dumps({}),
                    "created": "2026-11-06T12:00:00+00:00",
                },
            )

        command.upgrade(config, "head")
        with engine.connect() as connection:
            row = connection.execute(
                text(
                    "SELECT name, name_pt_br, instructions_pt_br, translated_by_id, "
                    "translated_at FROM exercises WHERE id = :id"
                ),
                {"id": exercise_id},
            ).one()
            assert tuple(row) == ("Test only", None, None, None, None)
            assert connection.scalar(text("SELECT count(*) FROM exercise_images")) == 0
        with engine.begin() as connection:
            try:
                connection.execute(
                    text("UPDATE exercises SET name_pt_br = 'Parcial' WHERE id = :id"),
                    {"id": exercise_id},
                )
            except Exception as exc:  # noqa: BLE001 - driver-specific error class
                assert "localization_complete" in str(exc)
            else:
                raise AssertionError("partial localization must be rejected")

        command.downgrade(config, "20261106_0013")
        assert not LOCALIZATION_COLUMNS & {
            column["name"] for column in inspect(engine).get_columns("exercises")
        }
        command.downgrade(config, "20261106_0012")
        assert "exercise_images" not in inspect(engine).get_table_names()
        with engine.connect() as connection:
            assert (
                connection.scalar(
                    text("SELECT name FROM exercises WHERE id = :id"),
                    {"id": exercise_id},
                )
                == "Test only"
            )
        command.upgrade(config, "head")
    finally:
        engine.dispose()
