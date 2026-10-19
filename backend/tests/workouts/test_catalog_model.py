from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.errors import ApiError
from app.modules.workouts.models import Workout, WorkoutItem, WorkoutRevision
from app.modules.workouts.prescriptions import prepare_items
from app.modules.workouts.schemas import WorkoutCreate


def test_catalog_requires_auth_and_returns_empty(client):
    assert client.get("/api/v1/exercises").status_code == 401


def test_catalog_detail_pagination(client, data, headers):
    auth = headers(data["pro"])
    response = client.get("/api/v1/exercises", headers=auth)
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert client.get("/api/v1/exercises?page=2", headers=auth).json()["items"] == []
    assert (
        client.get("/api/v1/exercises?page_size=101", headers=auth).status_code == 422
    )
    item = client.get(f"/api/v1/exercises/{data['exercise'].id}", headers=auth)
    assert item.json()["rule_version"] == "test-v1"
    assert client.get(f"/api/v1/exercises/{uuid4()}", headers=auth).status_code == 404


@pytest.mark.parametrize(
    "field,value",
    [
        ("sets", 0),
        ("repetitions", -1),
        ("rest_duration_ms", -1),
        ("sets", True),
        ("sets", 1.5),
        ("position", 2),
        ("side", "unknown"),
    ],
)
def test_invalid_items(payload, field, value):
    payload["items"][0][field] = value
    with pytest.raises(ValidationError):
        WorkoutCreate.model_validate(payload)


def test_unknown_fields_and_duplicate_positions(payload):
    payload["created_by"] = str(uuid4())
    with pytest.raises(ValidationError):
        WorkoutCreate.model_validate(payload)
    del payload["created_by"]
    payload["items"] *= 2
    with pytest.raises(ValidationError):
        WorkoutCreate.model_validate(payload)


@pytest.mark.parametrize(
    "change,code",
    [
        ({"side": "right"}, "unsupported_side"),
        ({"exercise_id": str(uuid4())}, "exercise_not_found"),
        ({"parameters": {"angle": 10}}, "unsupported_parameters"),
    ],
)
def test_exercise_validation(application, payload, change, code):
    payload["items"][0].update(change)
    with application.state.database.session() as session:
        with pytest.raises(ApiError) as error:
            prepare_items(session, WorkoutCreate.model_validate(payload).items)
        assert error.value.error.code == code


def test_persist_order_and_pinned_rule(application, data, payload):
    with application.state.database.session() as session:
        items = prepare_items(session, WorkoutCreate.model_validate(payload).items)
        workout = Workout(patient_id=data["patient"].id, created_by=data["pro"].id)
        session.add(workout)
        session.flush()
        revision = WorkoutRevision(workout_id=workout.id, revision_number=1)
        session.add(revision)
        session.flush()
        workout.current_revision_id = revision.id
        items[0].revision_id = revision.id
        session.add_all(items)
    with application.state.database.session() as session:
        item = session.scalar(select(WorkoutItem))
        assert item.position == 1
        assert item.rule_version == "test-v1"
        assert item.parameters == {}
        assert item.exercise_snapshot["code"] == "fictional-test-only"
        item.sets = 0
        with pytest.raises(IntegrityError):
            session.flush()
        session.rollback()


def test_empty_catalog_and_pending_parameters(
    application, client, data, headers, payload
):
    from app.modules.exercises.models import Exercise

    with application.state.database.session() as session:
        exercise = session.get(Exercise, data["exercise"].id)
        exercise.supported_parameters = {"pending": "clinical approval"}
        session.flush()
        with pytest.raises(ApiError) as error:
            prepare_items(session, WorkoutCreate.model_validate(payload).items)
        assert error.value.error.code == "parameter_contract_pending"
        exercise.is_active = False
    response = client.get("/api/v1/exercises", headers=headers(data["pro"]))
    assert response.json() == dict(items=[], page=1, page_size=20, total=0, pages=0)
