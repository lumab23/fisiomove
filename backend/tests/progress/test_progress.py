from copy import deepcopy
from datetime import datetime, timedelta
from uuid import uuid4

from app.modules.auth.models import User, UserRole
from app.modules.patients.models import Patient


def record_session(client, data, headers, payload):
    response = client.post(
        "/api/v1/me/sessions",
        headers=headers(data["patient_user"]),
        json=payload,
    )
    assert response.status_code == 201, response.text
    return response.json()


def interrupted_payload(session_payload):
    payload = deepcopy(session_payload)
    payload["client_session_id"] = str(uuid4())
    payload["status"] = "interrupted"
    started_at = datetime.fromisoformat(session_payload["started_at"]) + timedelta(
        minutes=10
    )
    payload["started_at"] = started_at.isoformat()
    payload["finished_at"] = (started_at + timedelta(minutes=1)).isoformat()
    payload["active_duration_ms"] = 60000
    payload["items"][0].update(
        completed_sets=1,
        completed_repetitions=2,
        active_duration_ms=60000,
        interrupted=True,
    )
    return payload


def test_empty_history_and_progress_return_coherent_zeros(client, data, headers):
    auth = headers(data["patient_user"])
    history = client.get("/api/v1/me/sessions", headers=auth)
    assert history.status_code == 200
    assert history.json() == dict(items=[], page=1, page_size=20, total=0, pages=0)

    progress = client.get(
        "/api/v1/me/progress?period_start=2026-10-01T00:00:00Z"
        "&period_end=2026-10-31T23:59:59Z",
        headers=auth,
    )
    assert progress.status_code == 200
    assert progress.json()["completed_sessions"] == 0
    assert progress.json()["interrupted_sessions"] == 0
    assert progress.json()["active_duration_ms"] == 0
    assert progress.json()["prescribed_repetitions"] == 0
    assert progress.json()["performed_repetitions"] == 0
    assert progress.json()["score"] == 0


def test_history_filters_paginates_and_returns_session_details(
    client, data, headers, session_payload
):
    completed = record_session(client, data, headers, session_payload)
    interrupted = record_session(
        client, data, headers, interrupted_payload(session_payload)
    )
    auth = headers(data["patient_user"])
    period_start = datetime.fromisoformat(session_payload["started_at"])
    period_end = period_start + timedelta(minutes=10)
    query = {
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "page_size": 1,
    }
    first = client.get("/api/v1/me/sessions", params=query, headers=auth).json()
    assert first["total"] == 2
    assert first["pages"] == 2
    assert first["items"][0]["status"] == "interrupted"
    assert first["items"][0]["prescribed_repetitions"] == 6
    assert first["items"][0]["performed_repetitions"] == 2

    second = client.get(
        "/api/v1/me/sessions", params={**query, "page": 2}, headers=auth
    ).json()
    assert second["items"][0]["status"] == "completed"
    detail = client.get(f"/api/v1/me/sessions/{completed['id']}", headers=auth)
    assert detail.status_code == 200
    assert (
        detail.json()["workout_snapshot"]["workout_revision_id"]
        == (session_payload["workout_revision_id"])
    )
    assert detail.json()["id"] != interrupted["id"]

    outside_period = client.get(
        "/api/v1/me/sessions",
        params={"period_start": (period_start + timedelta(days=1)).isoformat()},
        headers=auth,
    )
    assert outside_period.json()["items"] == []


def test_progress_counts_each_persisted_session_once_and_separates_statuses(
    client, data, headers, session_payload
):
    first = record_session(client, data, headers, session_payload)
    retry = record_session(client, data, headers, session_payload)
    assert retry["id"] == first["id"]
    record_session(client, data, headers, interrupted_payload(session_payload))

    period_start = datetime.fromisoformat(session_payload["started_at"])
    progress = client.get(
        "/api/v1/me/progress",
        params={
            "period_start": period_start.isoformat(),
            "period_end": (period_start + timedelta(hours=1)).isoformat(),
        },
        headers=headers(data["patient_user"]),
    )
    assert progress.status_code == 200
    body = progress.json()
    assert body["completed_sessions"] == 1
    assert body["interrupted_sessions"] == 1
    assert body["active_duration_ms"] == 240000
    assert body["prescribed_repetitions"] == 12
    assert body["performed_repetitions"] == 8
    assert body["score"] == 8


def test_professional_reads_only_patients_with_active_link(
    client, data, headers, session_payload
):
    record_session(client, data, headers, session_payload)
    linked = client.get(
        f"/api/v1/patients/{data['patient'].id}/sessions",
        headers=headers(data["pro"]),
    )
    assert linked.status_code == 200
    assert linked.json()["total"] == 1

    period_start = datetime.fromisoformat(session_payload["started_at"])
    progress = client.get(
        f"/api/v1/patients/{data['patient'].id}/progress",
        params={
            "period_start": period_start.isoformat(),
            "period_end": (period_start + timedelta(days=1)).isoformat(),
        },
        headers=headers(data["pro"]),
    )
    assert progress.status_code == 200
    assert progress.json()["completed_sessions"] == 1

    other_patient = client.post(
        "/api/v1/patients",
        headers=headers(data["other"]),
        json={"full_name": "Unlinked patient"},
    ).json()
    assert (
        client.get(
            f"/api/v1/patients/{other_patient['id']}/sessions",
            headers=headers(data["pro"]),
        ).status_code
        == 404
    )
    assert (
        client.get(
            f"/api/v1/patients/{other_patient['id']}/progress"
            "?period_start=2026-10-01T00:00:00Z"
            "&period_end=2026-10-31T23:59:59Z",
            headers=headers(data["pro"]),
        ).status_code
        == 404
    )
    assert (
        client.get(
            f"/api/v1/patients/{data['patient'].id}/sessions"
            f"/{linked.json()['items'][0]['id']}",
            headers=headers(data["other"]),
        ).status_code
        == 404
    )


def test_patient_cannot_read_another_patients_session(
    application, client, data, headers, session_payload
):
    result = record_session(client, data, headers, session_payload)
    with application.state.database.session() as session:
        another_user = User(
            email=f"{uuid4()}@example.com",
            role=UserRole.PATIENT,
            password_hash="unused-test-hash",
        )
        session.add(another_user)
        session.flush()
        session.add(Patient(full_name="Another patient", user_id=another_user.id))
        session.flush()

    response = client.get(
        f"/api/v1/me/sessions/{result['id']}", headers=headers(another_user)
    )
    assert response.status_code == 404


def test_invalid_periods_and_missing_timezone_are_rejected(client, data, headers):
    auth = headers(data["patient_user"])
    reversed_period = client.get(
        "/api/v1/me/sessions?period_start=2026-10-21T00:00:00Z"
        "&period_end=2026-10-20T00:00:00Z",
        headers=auth,
    )
    assert reversed_period.status_code == 422
    no_timezone = client.get(
        "/api/v1/me/progress?period_start=2026-10-01T00:00:00"
        "&period_end=2026-10-31T23:59:59Z",
        headers=auth,
    )
    assert no_timezone.status_code == 422
