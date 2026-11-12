from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.errors import ApiError
from app.modules.exercises.models import Exercise, ExerciseApprovalEvent
from app.modules.exercises.services import ExerciseGovernanceService


def pending_exercise(session, *, parameters=None):
    exercise = Exercise(
        code=f"pending-{uuid4()}",
        name="Technical pending exercise",
        instructions="Not available for clinical use",
        allowed_sides=["left"],
        rule_version="test-v1",
        supported_parameters=parameters or {},
    )
    session.add(exercise)
    session.flush()
    return exercise


def test_pending_and_stale_rule_versions_are_not_available(
    application, client, data, headers, payload
):
    with application.state.database.session() as session:
        pending_exercise(session)
        approved = session.get(Exercise, data["exercise"].id)
        approved.rule_version = "test-v2"

    catalog = client.get("/api/v1/exercises", headers=headers(data["pro"]))
    assert catalog.status_code == 200
    assert catalog.json()["items"] == []
    response = client.post(
        f"/api/v1/patients/{data['patient'].id}/workouts",
        headers=headers(data["pro"]),
        json=payload,
    )
    assert response.status_code == 404
    assert response.json()["code"] == "exercise_not_found"


def test_approval_evidence_is_internal_versioned_and_append_only(application, data):
    with application.state.database.session() as session:
        exercise = pending_exercise(session)
        service = ExerciseGovernanceService(session)
        with pytest.raises(ApiError) as forbidden:
            service.approve(
                data["patient_user"], exercise.id, "test-fixture://approval/v1"
            )
        assert forbidden.value.error.code == "clinical_approval_forbidden"
        with pytest.raises(ApiError) as invalid_reference:
            service.approve(data["pro"], exercise.id, "  ")
        assert (
            invalid_reference.value.error.code == "approval_document_reference_invalid"
        )

        approved = service.approve(
            data["pro"], exercise.id, "test-fixture://approval/v1"
        )
        assert approved.approval_status == "approved"
        assert approved.approved_rule_version == approved.rule_version
        assert approved.approved_by_id == data["pro"].id
        assert approved.approved_at is not None
        service.revoke(data["pro"], exercise.id, "test-fixture://revocation/v1")
        events = list(
            session.scalars(
                select(ExerciseApprovalEvent)
                .where(ExerciseApprovalEvent.exercise_id == exercise.id)
                .order_by(ExerciseApprovalEvent.decided_at)
            )
        )
        assert [event.decision for event in events] == ["approved", "revoked"]
        assert events[0].rule_version == "test-v1"
        assert approved.approval_status == "revoked"


def test_parameterized_exercise_cannot_be_approved_without_validator(application, data):
    with application.state.database.session() as session:
        exercise = pending_exercise(
            session, parameters={"reference_angle": {"unit": "degree"}}
        )
        with pytest.raises(ApiError) as error:
            ExerciseGovernanceService(session).approve(
                data["pro"], exercise.id, "test-fixture://approval/v1"
            )
        assert error.value.error.code == "parameter_contract_pending"


def test_approved_state_requires_complete_evidence(application):
    with application.state.database.session() as session:
        exercise = pending_exercise(session)
        exercise.approval_status = "approved"
        with pytest.raises(IntegrityError):
            session.flush()
        session.rollback()


def test_revocation_blocks_new_prescriptions_but_keeps_published_snapshot(
    application, client, data, headers, payload
):
    draft = client.post(
        f"/api/v1/patients/{data['patient'].id}/workouts",
        headers=headers(data["pro"]),
        json=payload,
    )
    assert draft.status_code == 201, draft.text
    published = client.post(
        f"/api/v1/workouts/{draft.json()['id']}/publish",
        headers=headers(data["pro"]),
    )
    assert published.status_code == 200, published.text
    assert published.json()["items"][0]["exercise_snapshot"]["approval_status"] == (
        "approved"
    )

    with application.state.database.session() as session:
        exercise = session.get(Exercise, data["exercise"].id)
        ExerciseGovernanceService(session).revoke(
            data["pro"], exercise.id, "test-fixture://revocation/v1"
        )

    new_workout = client.post(
        f"/api/v1/patients/{data['patient'].id}/workouts",
        headers=headers(data["pro"]),
        json=payload,
    )
    assert new_workout.status_code == 404
    preserved = client.get(
        f"/api/v1/workouts/{published.json()['id']}",
        headers=headers(data["patient_user"]),
    )
    assert preserved.status_code == 200
    assert (
        preserved.json()["current_revision_id"]
        == published.json()["current_revision_id"]
    )
