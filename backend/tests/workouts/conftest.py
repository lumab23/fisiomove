from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Environment, Settings
from app.main import create_app
from app.modules.auth.models import User, UserRole
from app.modules.auth.security import PasswordManager, TokenService
from app.modules.exercises.models import Exercise
from app.modules.exercises.services import ExerciseGovernanceService
from app.modules.patients.models import Patient, ProfessionalPatientLink
from app.modules.workouts.models import (  # noqa: F401
    Workout,
    WorkoutItem,
    WorkoutRevision,
)


@pytest.fixture
def application(migrated_database_url: str) -> Generator[FastAPI, None, None]:
    settings = Settings(
        _env_file=None,
        environment=Environment.TEST,
        database_url=migrated_database_url,
        auth_secret_key="tests-only-secret-key-with-at-least-32-characters",
    )
    app = create_app(settings)
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
        ExerciseGovernanceService(session).approve(
            users[0], exercise.id, "test-fixture://fictional-exercise/v1"
        )
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
