"""Opt-in integration against disposable databases on a test PostgreSQL server."""

import os
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path
from threading import Barrier
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, inspect, select
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError

from app.core.config import Environment, Settings
from app.db.base import Base
from app.main import create_app
from app.modules.achievements.models import Achievement
from app.modules.auth.models import User, UserRole
from app.modules.auth.security import PasswordManager
from app.modules.exercises.models import Exercise
from app.modules.patients.models import Patient
from app.modules.sessions.models import SessionResult
from app.modules.sessions.schemas import SessionResultCreate
from app.modules.sessions.services import SessionService
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
            other_professional = User(
                email="other-professional@example.com",
                role=UserRole.PHYSIOTHERAPIST,
                password_hash=PasswordManager().hash("OtherProfessional123!"),
            )
            exercise = Exercise(
                code="fictional-test-only",
                name="Integration fixture only",
                instructions="No clinical use",
                allowed_sides=["left"],
                rule_version="test-v1",
                supported_parameters={},
            )
            session.add_all([professional, other_professional, exercise])
            session.flush()
        with pytest.raises(RuntimeError, match="rollback probe"):
            with database.session() as session:
                session.add(
                    Exercise(
                        code="rollback-only",
                        name="Rollback probe",
                        instructions="Never committed",
                        allowed_sides=["left"],
                        rule_version="test-v1",
                        supported_parameters={},
                    )
                )
                session.flush()
                raise RuntimeError("rollback probe")
        with database.session() as session:
            assert (
                session.scalar(select(Exercise).where(Exercise.code == "rollback-only"))
                is None
            )
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
            other_login = client.post(
                "/api/v1/auth/login",
                json={
                    "email": other_professional.email,
                    "password": "OtherProfessional123!",
                },
            )
            other_headers = {
                "Authorization": f"Bearer {other_login.json()['access_token']}"
            }
            other_patient = client.post(
                "/api/v1/patients",
                headers=other_headers,
                json={
                    "full_name": "Other integration patient",
                    "email": "other-patient@example.com",
                },
            )
            assert other_patient.status_code == 201, other_patient.text
            other_patient_id = other_patient.json()["id"]
            assert (
                client.get(
                    f"/api/v1/patients/{other_patient_id}", headers=pro_headers
                ).status_code
                == 404
            )
            assert (
                client.get(
                    f"/api/v1/patients/{patient_id}", headers=other_headers
                ).status_code
                == 404
            )
            other_access = client.post(
                f"/api/v1/patients/{other_patient_id}/access",
                headers=other_headers,
                json={"operation": "activate"},
            )
            assert other_access.status_code == 200, other_access.text
            other_patient_login = client.post(
                "/api/v1/auth/login",
                json={
                    "email": "other-patient@example.com",
                    "password": other_access.json()["temporary_password"],
                },
            )
            other_patient_headers = {
                "Authorization": (
                    f"Bearer {other_patient_login.json()['access_token']}"
                )
            }
            assert (
                client.post(
                    "/api/v1/auth/change-password",
                    headers=other_patient_headers,
                    json={
                        "current_password": other_access.json()["temporary_password"],
                        "new_password": "OtherPatientPassword123!",
                    },
                ).status_code
                == 204
            )
            other_patient_login = client.post(
                "/api/v1/auth/login",
                json={
                    "email": "other-patient@example.com",
                    "password": "OtherPatientPassword123!",
                },
            )
            other_patient_headers = {
                "Authorization": (
                    f"Bearer {other_patient_login.json()['access_token']}"
                )
            }
            stale_refresh_token = login.json()["refresh_token"]
            reset = client.post(
                f"/api/v1/patients/{patient_id}/access",
                headers=pro_headers,
                json={"operation": "reset_temporary_password"},
            )
            assert reset.status_code == 200, reset.text
            assert (
                client.get("/api/v1/auth/me", headers=patient_headers).status_code
                == 401
            )
            assert (
                client.post(
                    "/api/v1/auth/refresh",
                    json={"refresh_token": stale_refresh_token},
                ).status_code
                == 401
            )
            reset_password = reset.json()["temporary_password"]
            login = client.post(
                "/api/v1/auth/login",
                json={
                    "email": "patient@example.com",
                    "password": reset_password,
                },
            )
            reset_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
            assert (
                client.post(
                    "/api/v1/auth/change-password",
                    headers=reset_headers,
                    json={
                        "current_password": reset_password,
                        "new_password": "FinalPatientPassword123!",
                    },
                ).status_code
                == 204
            )
            login = client.post(
                "/api/v1/auth/login",
                json={
                    "email": "patient@example.com",
                    "password": "FinalPatientPassword123!",
                },
            )
            patient_headers = {
                "Authorization": f"Bearer {login.json()['access_token']}"
            }
            final_refresh_token = login.json()["refresh_token"]
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
            assert (
                client.get(
                    f"/api/v1/workouts/{workout_id}", headers=other_patient_headers
                ).status_code
                == 404
            )
            revision_id = UUID(published.json()["current_revision_id"])
            session_started_at = datetime.fromisoformat(
                published.json()["published_at"]
            )
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

            session_payload = {
                "client_session_id": str(uuid4()),
                "workout_id": workout_id,
                "workout_revision_id": str(revision_id),
                "status": "completed",
                "started_at": session_started_at.isoformat(),
                "finished_at": (session_started_at + timedelta(minutes=5)).isoformat(),
                "active_duration_ms": 180000,
                "items": [
                    {
                        "workout_item_id": published.json()["items"][0]["id"],
                        "position": 1,
                        "completed_sets": 2,
                        "completed_repetitions": 6,
                        "active_duration_ms": 150000,
                        "interrupted": False,
                    }
                ],
            }
            barrier = Barrier(2)

            def record_same_session() -> UUID:
                with database.session() as session:
                    patient_user = session.scalar(
                        select(User).where(User.email == "patient@example.com")
                    )
                    assert patient_user is not None
                    barrier.wait(timeout=10)
                    return (
                        SessionService(session)
                        .create(
                            patient_user,
                            SessionResultCreate.model_validate(session_payload),
                        )
                        .id
                    )

            with ThreadPoolExecutor(max_workers=2) as pool:
                result_ids = list(pool.map(lambda _: record_same_session(), range(2)))
            assert result_ids[0] == result_ids[1]
            with database.session() as session:
                assert (
                    session.scalar(select(func.count()).select_from(SessionResult)) == 1
                )
                assert (
                    session.scalar(select(func.count()).select_from(Achievement)) == 1
                )

            retry = client.post(
                "/api/v1/me/sessions",
                headers=patient_headers,
                json=session_payload,
            )
            assert retry.status_code == 201
            assert retry.json()["id"] == str(result_ids[0])
            divergent = dict(session_payload)
            divergent["feedback_summary"] = {"changed": True}
            conflict = client.post(
                "/api/v1/me/sessions",
                headers=patient_headers,
                json=divergent,
            )
            assert conflict.status_code == 409
            assert conflict.json()["code"] == "idempotency_conflict"

            interrupted = {
                **session_payload,
                "client_session_id": str(uuid4()),
                "status": "interrupted",
                "finished_at": (session_started_at + timedelta(minutes=1)).isoformat(),
                "active_duration_ms": 60000,
                "items": [
                    {
                        **session_payload["items"][0],
                        "completed_sets": 1,
                        "completed_repetitions": 2,
                        "active_duration_ms": 60000,
                        "interrupted": True,
                    }
                ],
            }
            assert (
                client.post(
                    "/api/v1/me/sessions",
                    headers=patient_headers,
                    json=interrupted,
                ).status_code
                == 201
            )
            history = client.get("/api/v1/me/sessions", headers=patient_headers).json()
            assert history["total"] == 2
            period_end = (session_started_at + timedelta(days=1)).isoformat()
            progress = client.get(
                "/api/v1/me/progress",
                headers=patient_headers,
                params={
                    "period_start": session_started_at.isoformat(),
                    "period_end": period_end,
                },
            )
            assert progress.status_code == 200, progress.text
            assert progress.json()["completed_sessions"] == 1
            assert progress.json()["interrupted_sessions"] == 1
            achievements = client.get(
                "/api/v1/me/achievements", headers=patient_headers
            )
            assert achievements.status_code == 200
            assert len(achievements.json()) == 1

            deactivated = client.patch(
                f"/api/v1/patients/{patient_id}",
                headers=pro_headers,
                json={"is_active": False},
            )
            assert deactivated.status_code == 200, deactivated.text
            assert (
                client.get("/api/v1/auth/me", headers=patient_headers).status_code
                == 403
            )
            assert (
                client.post(
                    "/api/v1/auth/refresh",
                    json={"refresh_token": final_refresh_token},
                ).status_code
                == 401
            )

            with database.session() as session:
                patient = session.get(Patient, UUID(patient_id))
                assert patient is not None
                assert patient.is_active is False
        with pytest.raises(IntegrityError):
            with database.session() as session:
                protected_professional = session.get(User, professional.id)
                assert protected_professional is not None
                session.delete(protected_professional)
                session.flush()
        with database.session() as session:
            assert session.get(User, professional.id) is not None
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
