from datetime import datetime, timedelta
from uuid import uuid4

import pytest


@pytest.fixture
def published_workout(client, data, headers, payload):
    response = client.post(
        f"/api/v1/patients/{data['patient'].id}/workouts",
        headers=headers(data["pro"]),
        json=payload,
    )
    assert response.status_code == 201, response.text
    workout = response.json()
    published = client.post(
        f"/api/v1/workouts/{workout['id']}/publish",
        headers=headers(data["pro"]),
    )
    assert published.status_code == 200, published.text
    return published.json()


@pytest.fixture
def session_payload(published_workout):
    started_at = datetime.fromisoformat(published_workout["published_at"])
    finished_at = started_at + timedelta(minutes=5)
    return {
        "client_session_id": str(uuid4()),
        "workout_id": published_workout["id"],
        "workout_revision_id": published_workout["current_revision_id"],
        "status": "completed",
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "active_duration_ms": 180000,
        "low_confidence_summary": None,
        "feedback_summary": None,
        "items": [
            {
                "workout_item_id": published_workout["items"][0]["id"],
                "position": 1,
                "completed_sets": 2,
                "completed_repetitions": 6,
                "active_duration_ms": 150000,
                "interrupted": False,
            }
        ],
    }
