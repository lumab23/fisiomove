"""`counting_rule` on workout items and `counting_mode` on session items (DEC-013).

Fixtures are fictional; no clinical value is defined here.
"""

import hashlib
import json
from copy import deepcopy
from datetime import datetime, timedelta
from uuid import UUID, uuid4

import pytest

from app.modules.exercises.models import Exercise
from app.modules.exercises.services import ExerciseGovernanceService
from app.modules.sessions.models import SessionResult
from app.modules.sessions.schemas import SessionResultCreate
from app.modules.workouts.models import WorkoutItem

RULE = "demo-elbow-flexion:v1"


def publish(client, data, headers, body):
    created = client.post(
        f"/api/v1/patients/{data['patient'].id}/workouts",
        headers=headers(data["pro"]),
        json=body,
    )
    assert created.status_code == 201, created.text
    published = client.post(
        f"/api/v1/workouts/{created.json()['id']}/publish",
        headers=headers(data["pro"]),
    )
    assert published.status_code == 200, published.text
    return published.json()


def with_rule(payload, rule=RULE):
    body = deepcopy(payload)
    body["items"][0]["counting_rule"] = rule
    return body


def session_for(workout, counting_mode=None):
    started_at = datetime.fromisoformat(workout["published_at"])
    item = {
        "workout_item_id": workout["items"][0]["id"],
        "position": 1,
        "completed_sets": 2,
        "completed_repetitions": 6,
        "active_duration_ms": 1000,
        "interrupted": False,
    }
    if counting_mode is not None:
        item["counting_mode"] = counting_mode
    return {
        "client_session_id": str(uuid4()),
        "workout_id": workout["id"],
        "workout_revision_id": workout["current_revision_id"],
        "status": "completed",
        "started_at": started_at.isoformat(),
        "finished_at": (started_at + timedelta(minutes=1)).isoformat(),
        "active_duration_ms": 1000,
        "items": [item],
    }


def post_session(client, data, headers, body):
    return client.post(
        "/api/v1/me/sessions", headers=headers(data["patient_user"]), json=body
    )


def test_counting_rule_defaults_to_null_and_goes_into_the_snapshot(
    application, client, data, headers, payload
):
    manual = publish(client, data, headers, payload)
    assert manual["items"][0]["counting_rule"] is None

    automatic = publish(client, data, headers, with_rule(payload))
    assert automatic["items"][0]["counting_rule"] == RULE
    listed = client.get("/api/v1/me/workouts", headers=headers(data["patient_user"]))
    rules = {
        workout["id"]: workout["items"][0]["counting_rule"]
        for workout in listed.json()["items"]
    }
    assert rules == {manual["id"]: None, automatic["id"]: RULE}

    response = post_session(client, data, headers, session_for(automatic, "automatic"))
    assert response.status_code == 201, response.text
    assert response.json()["workout_snapshot"]["items"][0]["counting_rule"] == RULE
    with application.state.database.session() as session:
        stored = session.get(WorkoutItem, UUID(automatic["items"][0]["id"]))
        assert stored.counting_rule == RULE


def test_counting_rule_survives_edits_that_keep_items(client, data, headers, payload):
    workout = publish(client, data, headers, with_rule(payload))
    edited = client.patch(
        f"/api/v1/workouts/{workout['id']}",
        headers=headers(data["pro"]),
        json={"instructions": "Edited test prescription"},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["items"][0]["counting_rule"] == RULE
    removed = client.patch(
        f"/api/v1/workouts/{workout['id']}",
        headers=headers(data["pro"]),
        json={"items": payload["items"]},
    )
    assert removed.json()["items"][0]["counting_rule"] is None


@pytest.mark.parametrize("rule", ["demo-elbow-flexion:v2", "", "automatic", 1])
def test_unknown_counting_rule_is_rejected(client, data, headers, payload, rule):
    response = client.post(
        f"/api/v1/patients/{data['patient'].id}/workouts",
        headers=headers(data["pro"]),
        json=with_rule(payload, rule),
    )
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


def test_counting_rule_is_rejected_for_bilateral_items(
    application, client, data, headers, payload
):
    with application.state.database.session() as session:
        exercise = Exercise(
            code="fictional-bilateral-test-only",
            name="Bilateral test only",
            instructions="Not a clinical exercise",
            allowed_sides=["left", "bilateral"],
            rule_version="test-v1",
            supported_parameters={},
        )
        session.add(exercise)
        session.flush()
        ExerciseGovernanceService(session).approve(
            session.merge(data["pro"]),
            exercise.id,
            "test-fixture://fictional-bilateral/v1",
        )
        exercise_id = str(exercise.id)
    body = with_rule(payload)
    body["items"][0].update(exercise_id=exercise_id, side="bilateral")
    response = client.post(
        f"/api/v1/patients/{data['patient'].id}/workouts",
        headers=headers(data["pro"]),
        json=body,
    )
    assert response.status_code == 422
    assert response.json()["code"] == "counting_rule_unsupported_side"
    assert response.json()["details"] == {"field": "counting_rule", "position": 1}

    body["items"][0]["counting_rule"] = None
    assert (
        client.post(
            f"/api/v1/patients/{data['patient'].id}/workouts",
            headers=headers(data["pro"]),
            json=body,
        ).status_code
        == 201
    )


def test_counting_mode_defaults_to_manual(client, data, headers, published_workout):
    response = post_session(client, data, headers, session_for(published_workout))
    assert response.status_code == 201, response.text
    assert response.json()["items"][0]["counting_mode"] == "manual"
    explicit = post_session(
        client, data, headers, session_for(published_workout, "manual")
    )
    assert explicit.status_code == 201, explicit.text


@pytest.mark.parametrize("mode", ["automatic", "mixed"])
def test_automatic_modes_require_a_counting_rule(
    application, client, data, headers, published_workout, mode
):
    response = post_session(client, data, headers, session_for(published_workout, mode))
    assert response.status_code == 422
    assert response.json()["code"] == "counting_mode_unavailable"
    assert response.json()["details"] == {"field": "counting_mode", "position": 1}
    with application.state.database.session() as session:
        assert session.query(SessionResult).count() == 0


@pytest.mark.parametrize("mode", ["automatic", "mixed", "manual"])
def test_every_counting_mode_scores_the_same(client, data, headers, payload, mode):
    workout = publish(client, data, headers, with_rule(payload))
    response = post_session(client, data, headers, session_for(workout, mode))
    assert response.status_code == 201, response.text
    assert response.json()["items"][0]["counting_mode"] == mode
    assert response.json()["score"] == 6


@pytest.mark.parametrize("mode", ["camera", "", None, "AUTOMATIC"])
def test_unknown_counting_mode_is_rejected(
    client, data, headers, published_workout, mode
):
    body = session_for(published_workout)
    body["items"][0]["counting_mode"] = mode
    response = post_session(client, data, headers, body)
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


def test_counting_mode_is_part_of_idempotency(client, data, headers, payload):
    workout = publish(client, data, headers, with_rule(payload))
    body = session_for(workout, "automatic")
    first = post_session(client, data, headers, body)
    assert first.status_code == 201
    retry = post_session(client, data, headers, body)
    assert retry.status_code == 201
    assert retry.json()["id"] == first.json()["id"]
    changed = deepcopy(body)
    changed["items"][0]["counting_mode"] = "mixed"
    conflict = post_session(client, data, headers, changed)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "idempotency_conflict"


def test_results_stored_before_counting_mode_stay_idempotent(
    application, client, data, headers, published_workout
):
    """A legacy offline retry (no `counting_mode`) matches its stored hash."""
    body = session_for(published_workout)
    first = post_session(client, data, headers, body)
    assert first.status_code == 201
    # Pre-0015 formula: the schema dump, which then had no `counting_mode`.
    legacy_payload = SessionResultCreate.model_validate(body).model_dump(mode="json")
    for item in legacy_payload["items"]:
        del item["counting_mode"]
    legacy_items = legacy_payload["items"]
    legacy_hash = hashlib.sha256(
        json.dumps(legacy_payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    with application.state.database.session() as session:
        stored = session.get(SessionResult, UUID(first.json()["id"]))
        assert stored.payload_hash == legacy_hash
        stored.items = legacy_items
    retry = post_session(client, data, headers, body)
    assert retry.status_code == 201
    assert retry.json()["id"] == first.json()["id"]
    assert retry.json()["items"][0]["counting_mode"] == "manual"


def test_old_snapshot_without_counting_rule_rejects_automatic(
    application, client, data, headers, payload
):
    workout = publish(client, data, headers, with_rule(payload))
    with application.state.database.session() as session:
        stored = session.get(WorkoutItem, UUID(workout["items"][0]["id"]))
        stored.counting_rule = None
    response = post_session(client, data, headers, session_for(workout, "automatic"))
    assert response.status_code == 422
    assert response.json()["code"] == "counting_mode_unavailable"
