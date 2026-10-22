from copy import deepcopy
from uuid import UUID, uuid4

import pytest

from app.modules.patients.models import Patient, ProfessionalPatientLink
from app.modules.sessions.models import SessionResult


def create(client, data, headers, payload):
    response = client.post(
        "/api/v1/me/sessions",
        headers=headers(data["patient_user"]),
        json=payload,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_identical_retry_returns_persisted_session_once(
    application, client, data, headers, session_payload
):
    first = create(client, data, headers, session_payload)
    retry = create(client, data, headers, session_payload)
    assert retry["id"] == first["id"]
    with application.state.database.session() as session:
        assert session.query(SessionResult).count() == 1
        stored = session.get(SessionResult, UUID(first["id"]))
        assert stored.workout_snapshot["workout_revision_id"] == session_payload[
            "workout_revision_id"
        ]


def test_reused_idempotency_key_with_different_payload_conflicts(
    client, data, headers, session_payload
):
    create(client, data, headers, session_payload)
    changed = deepcopy(session_payload)
    changed["feedback_summary"] = {"effort": "different"}
    response = client.post(
        "/api/v1/me/sessions", headers=headers(data["patient_user"]), json=changed
    )
    assert response.status_code == 409
    assert response.json()["code"] == "idempotency_conflict"


@pytest.mark.parametrize(
    "change",
    [
        {"active_duration_ms": -1},
        {"items": [{
            "workout_item_id": "invalid",
            "position": 1,
            "completed_sets": 1,
            "completed_repetitions": 3,
            "active_duration_ms": 0,
            "interrupted": False,
        }]},
    ],
)
def test_invalid_values_are_rejected(client, data, headers, session_payload, change):
    payload = deepcopy(session_payload)
    payload.update(change)
    response = client.post(
        "/api/v1/me/sessions", headers=headers(data["patient_user"]), json=payload
    )
    assert response.status_code == 422


def test_result_above_prescription_is_rejected(client, data, headers, session_payload):
    payload = deepcopy(session_payload)
    payload["items"][0]["completed_repetitions"] = 7
    response = client.post(
        "/api/v1/me/sessions", headers=headers(data["patient_user"]), json=payload
    )
    assert response.status_code == 422
    assert response.json()["code"] == "session_result_exceeds_plan"


def test_revision_must_belong_to_an_accessible_published_workout(
    client, data, headers, session_payload
):
    payload = deepcopy(session_payload)
    payload["workout_revision_id"] = str(uuid4())
    response = client.post(
        "/api/v1/me/sessions", headers=headers(data["patient_user"]), json=payload
    )
    assert response.status_code == 404


def test_patient_cannot_record_session_for_another_patients_workout(
    application, client, data, headers, payload, session_payload
):
    with application.state.database.session() as session:
        other_patient = Patient(full_name="Unlinked test patient")
        session.add(other_patient)
        session.flush()
        session.add(
            ProfessionalPatientLink(
                physiotherapist_id=data["other"].id,
                patient_id=other_patient.id,
            )
        )
        session.flush()
        other_patient_id = other_patient.id

    draft = client.post(
        f"/api/v1/patients/{other_patient_id}/workouts",
        headers=headers(data["other"]),
        json=payload,
    )
    assert draft.status_code == 201, draft.text
    published = client.post(
        f"/api/v1/workouts/{draft.json()['id']}/publish",
        headers=headers(data["other"]),
    )
    assert published.status_code == 200, published.text

    foreign = deepcopy(session_payload)
    foreign["workout_id"] = published.json()["id"]
    foreign["workout_revision_id"] = published.json()["current_revision_id"]
    foreign["client_session_id"] = str(uuid4())
    foreign["items"][0]["workout_item_id"] = published.json()["items"][0]["id"]
    response = client.post(
        "/api/v1/me/sessions", headers=headers(data["patient_user"]), json=foreign
    )
    assert response.status_code == 404


def test_interrupted_session_keeps_partial_results(
    client, data, headers, session_payload
):
    payload = deepcopy(session_payload)
    payload["client_session_id"] = str(uuid4())
    payload["status"] = "interrupted"
    payload["items"][0].update(
        completed_sets=1,
        completed_repetitions=2,
        interrupted=True,
        active_duration_ms=60000,
    )
    payload["active_duration_ms"] = 60000
    payload["finished_at"] = "2026-10-20T14:01:00Z"
    response = client.post(
        "/api/v1/me/sessions", headers=headers(data["patient_user"]), json=payload
    )
    assert response.status_code == 201, response.text
    result = response.json()
    assert result["status"] == "interrupted"
    assert result["items"][0]["completed_repetitions"] == 2
    assert result["items"][0]["interrupted"] is True


def test_patient_id_cannot_be_supplied_by_client(
    client, data, headers, session_payload
):
    payload = deepcopy(session_payload)
    payload["patient_id"] = str(data["patient"].id)
    response = client.post(
        "/api/v1/me/sessions", headers=headers(data["patient_user"]), json=payload
    )
    assert response.status_code == 422
