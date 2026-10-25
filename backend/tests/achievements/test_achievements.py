from uuid import uuid4

from sqlalchemy import select

from app.modules.achievements.models import Achievement
from app.modules.achievements.services import AchievementService
from app.modules.sessions.models import SessionResult


def test_exact_completed_session_creates_one_readable_achievement(
    application, client, data, headers, session_payload
):
    first = client.post(
        "/api/v1/me/sessions",
        headers=headers(data["patient_user"]),
        json=session_payload,
    )
    assert first.status_code == 201, first.text
    assert first.json()["score"] == 6
    retry = client.post(
        "/api/v1/me/sessions",
        headers=headers(data["patient_user"]),
        json=session_payload,
    )
    assert retry.status_code == 201
    assert retry.json()["id"] == first.json()["id"]

    patient_read = client.get(
        "/api/v1/me/achievements", headers=headers(data["patient_user"])
    )
    assert patient_read.status_code == 200
    assert len(patient_read.json()) == 1
    assert patient_read.json()[0]["session_result_id"] == first.json()["id"]
    professional_read = client.get(
        f"/api/v1/patients/{data['patient'].id}/achievements",
        headers=headers(data["pro"]),
    )
    assert professional_read.status_code == 200
    assert len(professional_read.json()) == 1

    with application.state.database.session() as session:
        assert len(session.scalars(select(Achievement)).all()) == 1


def test_interrupted_session_does_not_create_achievement(
    application, client, data, headers, session_payload
):
    payload = dict(session_payload)
    payload.update(
        client_session_id="23abc456-7890-4abc-8def-1234567890ab",
        status="interrupted",
        active_duration_ms=60000,
        items=[
            {
                **session_payload["items"][0],
                "completed_sets": 1,
                "completed_repetitions": 2,
                "active_duration_ms": 60000,
                "interrupted": True,
            }
        ],
    )
    response = client.post(
        "/api/v1/me/sessions",
        headers=headers(data["patient_user"]),
        json=payload,
    )
    assert response.status_code == 201, response.text
    assert response.json()["score"] == 2
    assert (
        client.get(
            "/api/v1/me/achievements", headers=headers(data["patient_user"])
        ).json()
        == []
    )

    with application.state.database.session() as session:
        assert session.scalars(select(Achievement)).all() == []


def test_professional_cannot_read_unlinked_patient_achievements(client, data, headers):
    other = client.post(
        "/api/v1/patients",
        headers=headers(data["other"]),
        json={"full_name": "Unlinked patient"},
    ).json()
    response = client.get(
        f"/api/v1/patients/{other['id']}/achievements", headers=headers(data["pro"])
    )
    assert response.status_code == 404


def test_excess_over_snapshot_goal_does_not_award_achievement(application):
    with application.state.database.session() as session:
        result = SessionResult(
            id=uuid4(),
            patient_id=uuid4(),
            status="completed",
            score=6,
            workout_snapshot={"items": [{"id": "item-1", "sets": 2, "repetitions": 3}]},
            items=[
                {
                    "workout_item_id": "item-1",
                    "completed_sets": 2,
                    "completed_repetitions": 7,
                }
            ],
        )
        assert AchievementService(session).award_session_goal(result) is None
