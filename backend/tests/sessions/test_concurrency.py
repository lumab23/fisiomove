import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from sqlalchemy import func, select

from app.modules.achievements.models import Achievement
from app.modules.sessions.models import SessionResult

pytestmark = pytest.mark.skipif(
    not os.getenv("FISIOMOVE_TEST_POSTGRES_URL"),
    reason="Requires real PostgreSQL transactions",
)


def test_divergent_concurrent_retries_return_409_without_mutating_the_winner(
    client, application, data, headers, session_payload
) -> None:
    barrier = Barrier(2)
    auth = headers(data["patient_user"])
    payloads = [
        {**session_payload, "feedback_summary": {"attempt": i}} for i in range(2)
    ]

    def send(payload):
        barrier.wait(timeout=10)
        return client.post("/api/v1/me/sessions", headers=auth, json=payload)

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(send, payloads))
    assert sorted(response.status_code for response in responses) == [201, 409]
    winner_index = next(
        i for i, response in enumerate(responses) if response.status_code == 201
    )
    winner = responses[winner_index].json()
    loser = responses[1 - winner_index]
    assert loser.json()["code"] == "idempotency_conflict"
    retry = client.post(
        "/api/v1/me/sessions", headers=auth, json=payloads[winner_index]
    )
    assert retry.status_code == 201
    assert retry.json() == winner
    with application.state.database.session() as session:
        assert session.scalar(select(func.count()).select_from(SessionResult)) == 1
        assert session.scalar(select(func.count()).select_from(Achievement)) == 1
        stored = session.scalar(select(SessionResult))
        assert stored.feedback_summary == winner["feedback_summary"]
        assert stored.score == winner["score"]
        assert stored.workout_snapshot == winner["workout_snapshot"]
