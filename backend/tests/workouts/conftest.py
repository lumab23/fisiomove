from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Environment, Settings
from app.db.base import Base
from app.main import create_app
from app.modules.auth.models import User, UserRole
from app.modules.auth.security import PasswordManager, TokenService
from app.modules.exercises.models import Exercise
from app.modules.exercises.router import router as exercises_router
from app.modules.patients.models import Patient, ProfessionalPatientLink
from app.modules.workouts.models import (  # noqa: F401
    Workout,
    WorkoutItem,
    WorkoutRevision,
)


@pytest.fixture
def application(tmp_path) -> Generator[FastAPI, None, None]:
    settings = Settings(
        _env_file=None,
        environment=Environment.TEST,
        database_url=f"sqlite+pysqlite:///{tmp_path / 'workouts.db'}",
        auth_secret_key="tests-only-secret-key-with-at-least-32-characters",
    )
    app = create_app(settings)
    app.include_router(exercises_router, prefix="/api/v1")
    Base.metadata.create_all(app.state.database.engine)
    yield app
    app.state.database.dispose()


@pytest.fixture
def client(application) -> Generator[TestClient, None, None]:
    with TestClient(application) as value:
        yield value


@pytest.fixture
def data(application):
    with application.state.database.session() as session:
        users = []
        for role in [
            UserRole.PHYSIOTHERAPIST,
            UserRole.PHYSIOTHERAPIST,
            UserRole.PATIENT,
        ]:
            user = User(
                email=f"{uuid4()}@example.com",
                role=role,
                password_hash=PasswordManager().hash("TestPassword123!"),
            )
            session.add(user)
            session.flush()
            users.append(user)
        patient = Patient(full_name="Test patient", user_id=users[2].id)
        session.add(patient)
        session.flush()
        link = ProfessionalPatientLink(
            physiotherapist_id=users[0].id, patient_id=patient.id
        )
        exercise = Exercise(
            code="fictional-test-only",
            name="Test only",
            instructions="Not a clinical exercise",
            allowed_sides=["left"],
            rule_version="test-v1",
            supported_parameters={},
        )
        session.add_all([link, exercise])
        session.flush()
        return dict(
            pro=users[0],
            other=users[1],
            patient_user=users[2],
            patient=patient,
            link=link,
            exercise=exercise,
        )


@pytest.fixture
def headers(application):
    def make(user):
        token = TokenService(application.state.settings).create_access_token(user)
        return {"Authorization": f"Bearer {token}"}

    return make


@pytest.fixture
def payload(data):
    return {
        "instructions": "Test prescription",
        "items": [
            dict(
                position=1,
                exercise_id=str(data["exercise"].id),
                side="left",
                sets=2,
                repetitions=3,
                rest_duration_ms=0,
                parameters={},
            )
        ],
    }
