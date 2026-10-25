from copy import deepcopy

import pytest
from sqlalchemy import select

from app.modules.exercises.models import Exercise
from app.modules.exercises.services import ExerciseGovernanceService
from app.modules.patients.models import Patient, ProfessionalPatientLink
from app.modules.workouts.models import WorkoutItem, WorkoutRevision
from app.modules.workouts.services import WorkoutService


def create(client, data, headers, payload):
    response = client.post(
        f"/api/v1/patients/{data['patient'].id}/workouts",
        headers=headers(data["pro"]),
        json=payload,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_draft_publish_edit_archive_and_history(
    application, client, data, headers, payload
):
    pro = headers(data["pro"])
    patient = headers(data["patient_user"])
    draft = create(client, data, headers, payload)
    url = f"/api/v1/workouts/{draft['id']}"
    assert draft["status"] == "draft"
    assert client.get(url, headers=patient).status_code == 404
    assert client.get("/api/v1/me/workouts", headers=patient).json()["items"] == []
    published = client.post(url + "/publish", headers=pro).json()
    assert published["current_revision_id"] != draft["current_revision_id"]
    assert published["published_at"] is not None
    assert client.post(url + "/publish", headers=pro).status_code == 409
    assert client.get(url, headers=patient).status_code == 200
    assert client.get("/api/v1/me/workouts", headers=patient).json()["total"] == 1
    with application.state.database.session() as session:
        snapshot = WorkoutService(session).published_snapshot(
            data["patient_user"],
            data_uuid(published["id"]),
            data_uuid(published["current_revision_id"]),
        )
        exercise = session.get(Exercise, data["exercise"].id)
        exercise.rule_version = "test-v2"
        ExerciseGovernanceService(session).approve(
            data["pro"], exercise.id, "test-fixture://fictional-exercise/v2"
        )
    changed = deepcopy(payload)
    changed["items"][0]["repetitions"] = 4
    updated = client.patch(url, headers=pro, json=changed).json()
    assert updated["status"] == "draft"
    assert updated["items"][0]["rule_version"] == "test-v2"
    assert client.get(url, headers=patient).status_code == 404
    assert (
        client.patch(url, headers=pro, json={"instructions": None}).json()[
            "instructions"
        ]
        is None
    )
    client.post(url + "/publish", headers=pro)
    assert client.post(url + "/archive", headers=pro).json()["status"] == "archived"
    assert client.post(url + "/archive", headers=pro).status_code == 200
    assert client.get("/api/v1/me/workouts", headers=patient).json()["items"] == []
    assert client.patch(url, headers=pro, json=changed).status_code == 409
    assert client.post(url + "/publish", headers=pro).status_code == 409
    with application.state.database.session() as session:
        service = WorkoutService(session)
        assert (
            service.published_snapshot(
                data["patient_user"],
                data_uuid(published["id"]),
                data_uuid(published["current_revision_id"]),
            )
            == snapshot
        )
        old = session.get(WorkoutRevision, data_uuid(draft["current_revision_id"]))
        assert old.published_at is None
        item = session.scalar(
            select(WorkoutItem).where(WorkoutItem.revision_id == old.id)
        )
        assert item.repetitions == 3
        assert item.rule_version == "test-v1"
        snapshot["items"][0]["repetitions"] = 99
        assert (
            service.published_snapshot(
                data["patient_user"],
                data_uuid(published["id"]),
                data_uuid(published["current_revision_id"]),
            )["items"][0]["repetitions"]
            == 3
        )


def data_uuid(value):
    from uuid import UUID

    return UUID(value)


@pytest.mark.parametrize("actor,expected", [("other", 404), ("patient_user", 403)])
def test_forbidden_management(client, data, headers, payload, actor, expected):
    item = create(client, data, headers, payload)
    auth = headers(data[actor])
    assert (
        client.post(
            f"/api/v1/patients/{data['patient'].id}/workouts",
            headers=auth,
            json=payload,
        ).status_code
        == expected
    )
    url = f"/api/v1/workouts/{item['id']}"
    assert client.patch(url, headers=auth, json=payload).status_code == expected
    for action in ["publish", "archive"]:
        assert client.post(url + "/" + action, headers=auth).status_code == expected
    assert client.get(url, headers=auth).status_code == 404


def test_unlinked_patient_cannot_read_other_workout(
    application, client, data, headers, payload
):
    item = create(client, data, headers, payload)
    with application.state.database.session() as session:
        patient = session.get(Patient, data["patient"].id)
        patient.user_id = None
    client.post(f"/api/v1/workouts/{item['id']}/publish", headers=headers(data["pro"]))
    assert (
        client.get(
            f"/api/v1/workouts/{item['id']}", headers=headers(data["patient_user"])
        ).status_code
        == 404
    )


def test_revoked_link_and_invalid_patch(application, client, data, headers, payload):
    item = create(client, data, headers, payload)
    url = f"/api/v1/workouts/{item['id']}"
    pro = headers(data["pro"])
    for patch in [{}, {"items": None}, {"items": []}, {"status": "published"}]:
        assert client.patch(url, headers=pro, json=patch).status_code == 422
    with application.state.database.session() as session:
        session.get(ProfessionalPatientLink, data["link"].id).is_active = False
    assert client.get(url, headers=pro).status_code == 404
    assert client.patch(url, headers=pro, json=payload).status_code == 404


def test_authentication_and_pagination(application, client, data, headers, payload):
    item = create(client, data, headers, payload)
    assert client.get(f"/api/v1/workouts/{item['id']}").status_code == 401
    pro = headers(data["pro"])
    path = f"/api/v1/patients/{data['patient'].id}/workouts"
    assert client.get(path + "?page=2", headers=pro).json()["items"] == []
    assert client.get(path + "?page=0", headers=pro).status_code == 422
    assert client.get(path, headers=headers(data["other"])).status_code == 404
    with application.state.database.session() as session:
        from app.modules.auth.models import User

        session.get(User, data["pro"].id).must_change_password = True
    assert client.get(path, headers=pro).json()["code"] == "password_change_required"


def test_failed_edit_is_atomic(application, client, data, headers, payload):
    from uuid import uuid4

    item = create(client, data, headers, payload)
    auth = headers(data["pro"])
    url = f"/api/v1/workouts/{item['id']}"
    payload["items"][0]["exercise_id"] = str(uuid4())
    assert client.patch(url, json=payload, headers=auth).status_code == 404
    assert client.get(url, headers=auth).json() == item
    with application.state.database.session() as session:
        revisions = list(session.scalars(select(WorkoutRevision)))
        assert len(revisions) == 1


def test_snapshot_rejects_drafts_and_wrong_relationship(
    application, client, data, headers, payload
):
    from uuid import uuid4

    import pytest

    from app.core.errors import ApiError

    item = create(client, data, headers, payload)
    with application.state.database.session() as session:
        service = WorkoutService(session)
        for user, revision_id in [
            (data["pro"], data_uuid(item["current_revision_id"])),
            (data["pro"], uuid4()),
            (data["other"], data_uuid(item["current_revision_id"])),
        ]:
            with pytest.raises(ApiError):
                service.published_snapshot(user, data_uuid(item["id"]), revision_id)
