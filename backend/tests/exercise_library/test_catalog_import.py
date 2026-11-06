"""Adding reference exercises to the catalog (DEC-006); fake provider, no network."""

import os
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from threading import Barrier

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.modules.auth.models import User
from app.modules.exercise_library.importing import (
    LIBRARY_RULE_VERSION,
    CatalogImportService,
    catalog_code,
)
from app.modules.exercise_library.router import get_exercise_library_provider
from app.modules.exercises.models import Exercise, ExerciseApprovalEvent
from app.modules.exercises.services import ExerciseGovernanceService
from tests.exercise_library.test_routes import DETAIL, DETAIL_URL, FakeProvider

EXTERNAL_ID = DETAIL.external_id
URL = f"/api/v1/exercise-library/{EXTERNAL_ID}/catalog"
DETAIL_PATH = f"/api/v1/exercise-library/{EXTERNAL_ID}"
REFERENCE = (
    f"fisiomove:library-import:openexercisebase:{EXTERNAL_ID}; DEC-006 (uso acadêmico)"
)
EXPECTED_SOURCE = {
    "source": (
        "OpenExerciseBase (Ludwig Boltzmann Institute for Digital Health and "
        "Prevention)"
    ),
    "external_id": EXTERNAL_ID,
    "source_url": DETAIL_URL,
    "license": "CC BY-NC 4.0",
    "license_url": "https://creativecommons.org/licenses/by-nc/4.0/",
    "attribution": (
        "Name and instructions from OpenExerciseBase (Ludwig Boltzmann Institute "
        "for Digital Health and Prevention), licensed under CC BY-NC 4.0. Text is "
        "kept in the original language without edits."
    ),
}


@pytest.fixture
def provider(application: FastAPI) -> Generator[FakeProvider, None, None]:
    fake = FakeProvider()
    application.dependency_overrides[get_exercise_library_provider] = lambda: fake
    yield fake
    application.dependency_overrides.clear()


def _imported_count(application: FastAPI) -> tuple[int, int]:
    """(exercises from the library, approval events for them)."""
    with application.state.database.session() as session:
        exercises = session.scalar(
            select(func.count())
            .select_from(Exercise)
            .where(Exercise.source.is_not(None))
        )
        events = session.scalar(
            select(func.count())
            .select_from(ExerciseApprovalEvent)
            .join(Exercise, Exercise.id == ExerciseApprovalEvent.exercise_id)
            .where(Exercise.source.is_not(None))
        )
        return exercises or 0, events or 0


def test_adds_approved_exercise_with_provenance_and_audit_event(
    client: TestClient, application: FastAPI, provider: FakeProvider, data, headers
) -> None:
    response = client.post(
        URL, headers=headers(data["pro"]), json={"allowed_sides": ["right", "left"]}
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body == {
        "id": body["id"],
        "code": catalog_code(EXTERNAL_ID),
        "name": "Shoulder Press",
        "instructions": "1. Sit on a chair.\n2. Raise both arms.",
        "allowed_sides": ["right", "left"],
        "rule_version": LIBRARY_RULE_VERSION,
        "supported_parameters": {},
        "is_active": True,
        "approval_status": "approved",
        "approved_rule_version": LIBRARY_RULE_VERSION,
        "source": EXPECTED_SOURCE,
        "images": [{"position": 1, "url": f"/api/v1/exercises/{body['id']}/images/1"}],
        "localization": None,
    }
    assert body["code"].startswith("oeb-") and len(body["code"]) == 36
    assert provider.calls == [f"get:{EXTERNAL_ID}"]
    with application.state.database.session() as session:
        exercise = session.scalar(select(Exercise).where(Exercise.code == body["code"]))
        assert exercise is not None
        assert exercise.approved_by_id == data["pro"].id
        assert exercise.approval_document_reference == REFERENCE
        assert (
            exercise.source,
            exercise.source_external_id,
            exercise.source_url,
            exercise.source_license,
        ) == ("openexercisebase", EXTERNAL_ID, DETAIL_URL, "CC BY-NC 4.0")
        events = session.scalars(
            select(ExerciseApprovalEvent).where(
                ExerciseApprovalEvent.exercise_id == exercise.id
            )
        ).all()
        assert [
            (e.decision, e.decided_by_id, e.document_reference) for e in events
        ] == [("approved", data["pro"].id, REFERENCE)]
    catalog = client.get("/api/v1/exercises", headers=headers(data["pro"])).json()
    assert body["id"] in [item["id"] for item in catalog["items"]]


def test_second_add_returns_existing_without_overwriting_sides(
    client: TestClient, application: FastAPI, provider: FakeProvider, data, headers
) -> None:
    first = client.post(
        URL, headers=headers(data["pro"]), json={"allowed_sides": ["bilateral"]}
    )
    again = client.post(
        URL, headers=headers(data["other"]), json={"allowed_sides": ["left"]}
    )

    assert first.status_code == 201
    assert again.status_code == 200
    assert again.json() == first.json()
    assert again.json()["allowed_sides"] == ["bilateral"]
    assert provider.calls == [f"get:{EXTERNAL_ID}"]
    assert _imported_count(application) == (1, 1)


def test_concurrent_insert_is_resolved_by_rereading(
    client: TestClient,
    application: FastAPI,
    provider: FakeProvider,
    data,
    headers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Simulates losing the race: the first lookup misses a row that exists."""
    first = client.post(
        URL, headers=headers(data["pro"]), json={"allowed_sides": ["left"]}
    )
    real_find = CatalogImportService.find
    misses = iter([None])

    def stale_find(self: CatalogImportService, external_id: str) -> Exercise | None:
        return next(misses, real_find(self, external_id))

    monkeypatch.setattr(CatalogImportService, "find", stale_find)
    lost = client.post(
        URL, headers=headers(data["other"]), json={"allowed_sides": ["right"]}
    )

    assert first.status_code == 201
    assert lost.status_code == 200, lost.text
    assert lost.json() == first.json()
    assert _imported_count(application) == (1, 1)


@pytest.mark.skipif(
    not os.getenv("FISIOMOVE_TEST_POSTGRES_URL"),
    reason="Requires real PostgreSQL transactions",
)
def test_parallel_adds_create_one_exercise_on_postgresql(
    client: TestClient, application: FastAPI, provider: FakeProvider, data, headers
) -> None:
    barrier = Barrier(2)
    users = [data["pro"], data["other"]]

    def send(user: User):
        barrier.wait(timeout=10)
        return client.post(
            URL, headers=headers(user), json={"allowed_sides": ["bilateral"]}
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(send, users))

    assert sorted(r.status_code for r in responses) == [200, 201]
    assert responses[0].json()["id"] == responses[1].json()["id"]
    assert _imported_count(application) == (1, 1)


def test_detail_reports_catalog_status_per_physiotherapist(
    client: TestClient, application: FastAPI, provider: FakeProvider, data, headers
) -> None:
    before = client.get(DETAIL_PATH, headers=headers(data["pro"])).json()
    created = client.post(
        URL, headers=headers(data["pro"]), json={"allowed_sides": ["left"]}
    ).json()
    mine = client.get(DETAIL_PATH, headers=headers(data["pro"])).json()
    theirs = client.get(DETAIL_PATH, headers=headers(data["other"])).json()

    assert before["catalog_exercise"] is None
    assert mine["catalog_exercise"] == {
        "exercise_id": created["id"],
        "approval_status": "approved",
        "added_by_me": True,
    }
    assert theirs["catalog_exercise"] == {
        "exercise_id": created["id"],
        "approval_status": "approved",
        "added_by_me": False,
    }


def test_withdrawn_exercise_returns_409_and_is_not_reapproved(
    client: TestClient, application: FastAPI, provider: FakeProvider, data, headers
) -> None:
    created = client.post(
        URL, headers=headers(data["pro"]), json={"allowed_sides": ["left"]}
    ).json()
    with application.state.database.session() as session:
        actor = session.get(User, data["pro"].id)
        assert actor is not None
        exercise = session.scalar(
            select(Exercise).where(Exercise.code == created["code"])
        )
        assert exercise is not None
        ExerciseGovernanceService(session).revoke(actor, exercise.id, "test://revoke")

    response = client.post(
        URL, headers=headers(data["other"]), json={"allowed_sides": ["left"]}
    )
    detail = client.get(DETAIL_PATH, headers=headers(data["pro"])).json()

    assert response.status_code == 409
    assert response.json()["code"] == "catalog_exercise_revoked"
    assert detail["catalog_exercise"]["approval_status"] == "revoked"
    assert _imported_count(application) == (1, 2)


def test_unknown_reference_returns_404_without_writing(
    client: TestClient, application: FastAPI, provider: FakeProvider, data, headers
) -> None:
    response = client.post(
        "/api/v1/exercise-library/EX-missing-01/catalog",
        headers=headers(data["pro"]),
        json={"allowed_sides": ["left"]},
    )

    assert response.status_code == 404
    assert response.json()["code"] == "library_exercise_not_found"
    assert _imported_count(application) == (0, 0)


def test_provider_failure_returns_503_without_writing(
    client: TestClient, application: FastAPI, provider: FakeProvider, data, headers
) -> None:
    provider.fail = True

    response = client.post(
        URL, headers=headers(data["pro"]), json={"allowed_sides": ["left"]}
    )

    assert response.status_code == 503
    assert response.json()["code"] == "external_library_unavailable"
    assert response.headers["Retry-After"] == "30"
    assert _imported_count(application) == (0, 0)


def test_reference_without_instructions_returns_422_without_writing(
    client: TestClient,
    application: FastAPI,
    provider: FakeProvider,
    data,
    headers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        provider, "get_exercise", lambda _: replace(DETAIL, instructions=())
    )

    response = client.post(
        URL, headers=headers(data["pro"]), json={"allowed_sides": ["left"]}
    )

    assert response.status_code == 422
    assert response.json()["code"] == "library_exercise_without_instructions"
    assert _imported_count(application) == (0, 0)


def test_reference_beyond_column_limits_returns_422_without_writing(
    client: TestClient,
    application: FastAPI,
    provider: FakeProvider,
    data,
    headers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        provider, "get_exercise", lambda _: replace(DETAIL, name="x" * 201)
    )

    response = client.post(
        URL, headers=headers(data["pro"]), json={"allowed_sides": ["left"]}
    )

    assert response.status_code == 422
    assert response.json()["code"] == "library_exercise_too_long"
    assert _imported_count(application) == (0, 0)


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"allowed_sides": []},
        {"allowed_sides": ["left", "left"]},
        {"allowed_sides": ["left", "right", "bilateral", "left"]},
        {"allowed_sides": ["up"]},
        {"allowed_sides": "left"},
        {"allowed_sides": ["left"], "name": "Client-supplied name"},
        {"allowed_sides": ["left"], "sets": 3},
    ],
)
def test_invalid_body_returns_422_before_provider(
    client: TestClient,
    application: FastAPI,
    provider: FakeProvider,
    data,
    headers,
    body: dict,
) -> None:
    response = client.post(URL, headers=headers(data["pro"]), json=body)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert provider.calls == []
    assert _imported_count(application) == (0, 0)


def test_malformed_external_id_returns_422_before_provider(
    client: TestClient, provider: FakeProvider, data, headers
) -> None:
    response = client.post(
        "/api/v1/exercise-library/bad.id/catalog",
        headers=headers(data["pro"]),
        json={"allowed_sides": ["left"]},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert provider.calls == []


def test_only_physiotherapists_with_changed_password_can_add(
    client: TestClient, application: FastAPI, provider: FakeProvider, data, headers
) -> None:
    body = {"allowed_sides": ["left"]}
    anonymous = client.post(URL, json=body)
    patient = client.post(URL, headers=headers(data["patient_user"]), json=body)
    with application.state.database.session() as session:
        professional = session.get(User, data["pro"].id)
        assert professional is not None
        professional.must_change_password = True
        session.flush()
        session.expunge(professional)
    temporary = client.post(URL, headers=headers(professional), json=body)

    assert anonymous.status_code == 401
    assert anonymous.json()["code"] == "authentication_required"
    assert patient.status_code == 403
    assert patient.json()["code"] == "insufficient_role"
    assert temporary.status_code == 403
    assert temporary.json()["code"] == "password_change_required"
    assert provider.calls == []
    assert _imported_count(application) == (0, 0)


def test_partial_provenance_is_rejected_by_the_database(application: FastAPI) -> None:
    with pytest.raises(IntegrityError):
        with application.state.database.session() as session:
            session.add(
                Exercise(
                    code="fictional-partial-provenance",
                    name="Test only",
                    instructions="Not a clinical exercise",
                    allowed_sides=["left"],
                    rule_version="test-v1",
                    supported_parameters={},
                    source="openexercisebase",
                )
            )
            session.flush()


def test_imported_exercise_can_be_prescribed_published_and_seen_by_patient(
    client: TestClient, provider: FakeProvider, data, headers
) -> None:
    exercise = client.post(
        URL, headers=headers(data["pro"]), json={"allowed_sides": ["left", "right"]}
    ).json()
    item = {
        "position": 1,
        "exercise_id": exercise["id"],
        "side": "right",
        "sets": 2,
        "repetitions": 5,
        "rest_duration_ms": 30000,
        "parameters": {},
    }
    unsupported = client.post(
        f"/api/v1/patients/{data['patient'].id}/workouts",
        headers=headers(data["pro"]),
        json={
            "instructions": "Test prescription",
            "items": [{**item, "side": "bilateral"}],
        },
    )
    draft = client.post(
        f"/api/v1/patients/{data['patient'].id}/workouts",
        headers=headers(data["pro"]),
        json={"instructions": "Test prescription", "items": [item]},
    )
    assert draft.status_code == 201, draft.text
    published = client.post(
        f"/api/v1/workouts/{draft.json()['id']}/publish", headers=headers(data["pro"])
    )
    mine = client.get("/api/v1/me/workouts", headers=headers(data["patient_user"]))

    assert unsupported.status_code == 422
    assert unsupported.json()["code"] == "unsupported_side"
    assert published.status_code == 200, published.text
    assert mine.status_code == 200
    [workout] = mine.json()["items"]
    assert workout["id"] == draft.json()["id"]
    [prescribed] = workout["items"]
    assert prescribed["exercise_id"] == exercise["id"]
    assert (prescribed["side"], prescribed["sets"], prescribed["repetitions"]) == (
        "right",
        2,
        5,
    )
    assert prescribed["rule_version"] == LIBRARY_RULE_VERSION
    assert prescribed["exercise_snapshot"]["name"] == "Shoulder Press"
    assert prescribed["exercise_snapshot"]["source"] == EXPECTED_SOURCE
