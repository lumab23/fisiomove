"""Opt-in integration against disposable databases on a test PostgreSQL server."""

import os
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.engine import make_url

from app.core.config import Environment, Settings
from app.db.base import Base
from app.main import create_app
from app.modules.auth.models import User, UserRole
from app.modules.auth.security import PasswordManager
from app.modules.exercises.models import Exercise
from app.modules.workouts.models import WorkoutRevision
from app.modules.workouts.schemas import WorkoutUpdate
from app.modules.workouts.services import WorkoutService

BACKEND_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def postgres_url() -> Generator[str, None, None]:
    configured = os.getenv("FISIOMOVE_TEST_POSTGRES_URL")
    if not configured:
        pytest.skip(
            "Set FISIOMOVE_TEST_POSTGRES_URL to an isolated test PostgreSQL server"
        )
    admin_url = make_url(configured)
    if admin_url.get_backend_name() != "postgresql":
        pytest.fail("FISIOMOVE_TEST_POSTGRES_URL must use PostgreSQL")
    database_name = f"fisiomove_test_{uuid4().hex}"
    admin = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as connection:
            connection.exec_driver_sql(f'CREATE DATABASE "{database_name}"')
        try:
            yield admin_url.set(database=database_name).render_as_string(
                hide_password=False
            )
        finally:
            with admin.connect() as connection:
                connection.exec_driver_sql(
                    f'DROP DATABASE "{database_name}" WITH (FORCE)'
                )
    finally:
        admin.dispose()


def migration_config(url: str) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    return config


def test_postgresql_migrations_api_and_concurrent_revisions(postgres_url: str) -> None:
    config = migration_config(postgres_url)
    command.upgrade(config, "20261019_0003")
    command.upgrade(config, "head")
    settings = Settings(
        _env_file=None,
        environment=Environment.TEST,
        database_url=postgres_url,
        auth_secret_key="integration-only-secret-at-least-32-characters",
    )
    application = create_app(settings)
    database = application.state.database
    try:
        with database.engine.connect() as connection:
            assert (
                compare_metadata(MigrationContext.configure(connection), Base.metadata)
                == []
            )
            fks = inspect(connection).get_foreign_keys("workouts")
            assert any(fk["name"] == "fk_workouts_current_revision" for fk in fks)
        with database.session() as session:
            professional = User(
                email="professional@example.com",
                role=UserRole.PHYSIOTHERAPIST,
                password_hash=PasswordManager().hash("IntegrationPassword123!"),
            )
            exercise = Exercise(
                code="fictional-test-only",
                name="Integration fixture only",
                instructions="No clinical use",
                allowed_sides=["left"],
                rule_version="test-v1",
                supported_parameters={},
            )
            session.add_all([professional, exercise])
            session.flush()
        with TestClient(application) as client:
            response = client.post(
                "/api/v1/auth/login",
                json={
                    "email": professional.email,
                    "password": "IntegrationPassword123!",
                },
            )
            assert response.status_code == 200
            pro_headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
            response = client.post(
                "/api/v1/patients",
                headers=pro_headers,
                json={
                    "full_name": "Integration patient",
                    "email": "patient@example.com",
                },
            )
            assert response.status_code == 201
            patient_id = response.json()["id"]
            access = client.post(
                f"/api/v1/patients/{patient_id}/access",
                headers=pro_headers,
                json={"operation": "activate"},
            )
            assert access.status_code == 200
            temporary = access.json()["temporary_password"]
            login = client.post(
                "/api/v1/auth/login",
                json={"email": "patient@example.com", "password": temporary},
            )
            patient_headers = {
                "Authorization": f"Bearer {login.json()['access_token']}"
            }
            assert (
                client.post(
                    "/api/v1/auth/change-password",
                    headers=patient_headers,
                    json={
                        "current_password": temporary,
                        "new_password": "NewPatientPassword123!",
                    },
                ).status_code
                == 204
            )
            login = client.post(
                "/api/v1/auth/login",
                json={
                    "email": "patient@example.com",
                    "password": "NewPatientPassword123!",
                },
            )
            patient_headers = {
                "Authorization": f"Bearer {login.json()['access_token']}"
            }
            payload = {
                "items": [
                    dict(
                        position=1,
                        exercise_id=str(exercise.id),
                        side="left",
                        sets=2,
                        repetitions=3,
                        rest_duration_ms=0,
                    )
                ]
            }
            draft = client.post(
                f"/api/v1/patients/{patient_id}/workouts",
                headers=pro_headers,
                json=payload,
            )
            assert draft.status_code == 201, draft.text
            workout_id = draft.json()["id"]
            published = client.post(
                f"/api/v1/workouts/{workout_id}/publish", headers=pro_headers
            )
            assert published.status_code == 200
            revision_id = UUID(published.json()["current_revision_id"])
            assert (
                client.get("/api/v1/me/workouts", headers=patient_headers).json()[
                    "total"
                ]
                == 1
            )
            for visibility in ["patient_visible", "professional_only"]:
                assert (
                    client.post(
                        f"/api/v1/patients/{patient_id}/notes",
                        headers=pro_headers,
                        json={"content": "Test only", "visibility": visibility},
                    ).status_code
                    == 201
                )
            notes = client.get(
                f"/api/v1/patients/{patient_id}/notes", headers=patient_headers
            ).json()
            assert notes["total"] == 1
            assert all(x["visibility"] == "patient_visible" for x in notes["items"])
            # Two transactions racing to edit the same aggregate must serialize.
            barrier = Barrier(2)

            def edit(instructions: str) -> int:
                with database.session() as session:
                    barrier.wait(timeout=10)
                    return (
                        WorkoutService(session)
                        .update(
                            professional,
                            UUID(workout_id),
                            WorkoutUpdate(instructions=instructions),
                        )
                        .revision_number
                    )

            with ThreadPoolExecutor(max_workers=2) as pool:
                numbers = list(
                    pool.map(edit, ["Concurrent edit A", "Concurrent edit B"])
                )
            assert sorted(numbers) == [3, 4]
            with database.session() as session:
                snapshot = WorkoutService(session).published_snapshot(
                    professional, UUID(workout_id), revision_id
                )
                assert snapshot["items"][0]["repetitions"] == 3
                assert (
                    session.scalar(
                        select(WorkoutRevision).where(WorkoutRevision.id == revision_id)
                    ).published_at
                    is not None
                )
            assert (
                client.post(
                    f"/api/v1/workouts/{workout_id}/archive", headers=pro_headers
                ).status_code
                == 200
            )
            assert (
                client.get("/api/v1/me/workouts", headers=patient_headers).json()[
                    "items"
                ]
                == []
            )
        command.downgrade(config, "20261019_0003")
        assert "workouts" not in inspect(database.engine).get_table_names()
        assert "notes" not in inspect(database.engine).get_table_names()
        with database.session() as session:
            assert session.get(User, professional.id) is not None
        command.upgrade(config, "head")
        with database.engine.connect() as connection:
            assert (
                compare_metadata(MigrationContext.configure(connection), Base.metadata)
                == []
            )
        command.downgrade(config, "base")
        assert inspect(database.engine).get_table_names() == ["alembic_version"]
    finally:
        database.dispose()
