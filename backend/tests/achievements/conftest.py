from datetime import datetime, timedelta
from uuid import uuid4

import pytest


@pytest.fixture
def session_payload(client, data, headers, payload):
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
    workout = published.json()
    started_at = datetime.fromisoformat(workout["published_at"])
    return {
        "client_session_id": str(uuid4()),
        "workout_id": workout["id"],
        "workout_revision_id": workout["current_revision_id"],
        "status": "completed",
        "started_at": started_at.isoformat(),
        "finished_at": (started_at + timedelta(minutes=5)).isoformat(),
        "active_duration_ms": 180000,
        "low_confidence_summary": None,
        "feedback_summary": None,
        "items": [
            {
                "workout_item_id": workout["items"][0]["id"],
                "position": 1,
                "completed_sets": 2,
                "completed_repetitions": 6,
                "active_duration_ms": 150000,
                "interrupted": False,
            }
        ],
    }
