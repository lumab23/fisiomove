"""pt-BR text written by a physiotherapist (DEC-011); fake provider, no network.

The Portuguese strings below are fictional test data, not clinical guidance.
"""

from collections.abc import Generator
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.modules.auth.models import User
from app.modules.exercise_library.router import get_exercise_library_provider
from app.modules.exercises.models import Exercise, ExerciseApprovalEvent
from app.modules.exercises.schemas import TRANSLATOR_FALLBACK_NAME
from app.modules.exercises.services import ExerciseGovernanceService
from app.modules.physiotherapists.models import PhysiotherapistProfile
from tests.exercise_library.test_catalog_import import EXPECTED_SOURCE
from tests.exercise_library.test_routes import DETAIL, FakeProvider

URL = f"/api/v1/exercise-library/{DETAIL.external_id}/catalog"
TRANSLATION = {"name": "Teste fictício", "instructions": ["Passo um.", "Passo dois."]}
STORED_STEPS = "1. Passo um.\n2. Passo dois."


@pytest.fixture
def provider(application: FastAPI) -> Generator[FakeProvider, None, None]:
    fake = FakeProvider()
    application.dependency_overrides[get_exercise_library_provider] = lambda: fake
    yield fake
    application.dependency_overrides.clear()


@pytest.fixture
def imported(client: TestClient, provider: FakeProvider, data, headers) -> dict:
    response = client.post(
        URL, headers=headers(data["pro"]), json={"allowed_sides": ["left"]}
    )
    assert response.status_code == 201, response.text
    return response.json()


def _path(exercise_id: Any) -> str:
    return f"/api/v1/exercises/{exercise_id}/localization"


def _translated_attribution(translator: str, when: str) -> str:
    return (
        "Adapted from OpenExerciseBase (Ludwig Boltzmann Institute for Digital "
        "Health and Prevention), licensed under CC BY-NC 4.0. Name and "
        f"instructions translated into Portuguese by {translator} on {when}; the "
        "original English text is preserved."
    )


def _governance(application: FastAPI, exercise_id: str) -> tuple[Any, ...]:
    with application.state.database.session() as session:
        exercise = session.get(Exercise, UUID(exercise_id))
        assert exercise is not None
        events = session.scalar(
            select(func.count())
            .select_from(ExerciseApprovalEvent)
            .where(ExerciseApprovalEvent.exercise_id == exercise.id)
        )
        return (
            exercise.name,
            exercise.instructions,
            exercise.rule_version,
            exercise.approval_status,
            exercise.approved_rule_version,
            exercise.approved_by_id,
            exercise.approved_at,
            events,
        )


def test_any_physiotherapist_translates_without_touching_approval(
    client: TestClient, application: FastAPI, imported: dict, data, headers
) -> None:
    before = _governance(application, imported["id"])

    response = client.put(
        _path(imported["id"]), headers=headers(data["other"]), json=TRANSLATION
    )

    assert response.status_code == 200, response.text
    body = response.json()
    translated_at = datetime.fromisoformat(body["localization"]["translated_at"])
    assert translated_at.tzinfo is not None
    assert body["localization"] == {
        "language": "pt-BR",
        "name": "Teste fictício",
        "instructions": STORED_STEPS,
        "translated_by_name": TRANSLATOR_FALLBACK_NAME,
        "translated_at": body["localization"]["translated_at"],
    }
    assert body["name"] == "Shoulder Press"
    assert body["instructions"] == "1. Sit on a chair.\n2. Raise both arms."
    assert (body["rule_version"], body["approval_status"]) == (
        imported["rule_version"],
        "approved",
    )
    assert body["source"] == {
        **EXPECTED_SOURCE,
        "attribution": _translated_attribution(
            TRANSLATOR_FALLBACK_NAME, translated_at.astimezone(UTC).date().isoformat()
        ),
    }
    assert _governance(application, imported["id"]) == before
    with application.state.database.session() as session:
        exercise = session.get(Exercise, UUID(imported["id"]))
        assert exercise is not None
        assert exercise.translated_by_id == data["other"].id
        assert exercise.instructions_pt_br == STORED_STEPS
    shown = client.get(
        f"/api/v1/exercises/{imported['id']}", headers=headers(data["patient_user"])
    )
    assert shown.json()["localization"] == body["localization"]


def test_translator_profile_name_is_preferred_and_latest_edit_wins(
    client: TestClient, application: FastAPI, imported: dict, data, headers
) -> None:
    with application.state.database.session() as session:
        session.add(
            PhysiotherapistProfile(user_id=data["pro"].id, full_name="Fisio Fictícia")
        )
    first = client.put(
        _path(imported["id"]), headers=headers(data["other"]), json=TRANSLATION
    )
    second = client.put(
        _path(imported["id"]),
        headers=headers(data["pro"]),
        json={"name": "Outro nome", "instructions": ["Único passo."]},
    )

    assert first.status_code == 200
    assert second.status_code == 200, second.text
    localization = second.json()["localization"]
    assert (
        localization["name"],
        localization["instructions"],
        localization["translated_by_name"],
    ) == ("Outro nome", "1. Único passo.", "Fisio Fictícia")
    assert "by Fisio Fictícia on" in second.json()["source"]["attribution"]


def test_untranslated_exercise_keeps_original_attribution(
    client: TestClient, imported: dict, data, headers
) -> None:
    assert imported["localization"] is None
    assert imported["source"] == EXPECTED_SOURCE


def test_exercise_without_provenance_can_be_translated_without_source(
    client: TestClient, data, headers
) -> None:
    response = client.put(
        _path(data["exercise"].id), headers=headers(data["pro"]), json=TRANSLATION
    )

    assert response.status_code == 200, response.text
    assert response.json()["source"] is None
    assert response.json()["localization"]["name"] == "Teste fictício"


def test_only_active_physiotherapists_with_changed_password_translate(
    client: TestClient, application: FastAPI, imported: dict, data, headers
) -> None:
    path = _path(imported["id"])
    anonymous = client.put(path, json=TRANSLATION)
    patient = client.put(path, headers=headers(data["patient_user"]), json=TRANSLATION)
    with application.state.database.session() as session:
        professional = session.get(User, data["other"].id)
        assert professional is not None
        professional.must_change_password = True
        session.flush()
        session.expunge(professional)
    temporary = client.put(path, headers=headers(professional), json=TRANSLATION)
    with application.state.database.session() as session:
        inactive = session.get(User, data["pro"].id)
        assert inactive is not None
        inactive.is_active = False
        session.flush()
        session.expunge(inactive)
    disabled = client.put(path, headers=headers(inactive), json=TRANSLATION)

    assert anonymous.status_code == 401
    assert anonymous.json()["code"] == "authentication_required"
    assert patient.status_code == 403
    assert patient.json()["code"] == "insufficient_role"
    assert temporary.status_code == 403
    assert temporary.json()["code"] == "password_change_required"
    assert disabled.status_code == 403
    assert disabled.json()["code"] == "account_inactive"
    with application.state.database.session() as session:
        exercise = session.get(Exercise, UUID(imported["id"]))
        assert exercise is not None
        assert exercise.name_pt_br is None


def test_unknown_or_withdrawn_exercise_returns_404(
    client: TestClient, application: FastAPI, imported: dict, data, headers
) -> None:
    unknown = client.put(
        _path("00000000-0000-4000-8000-000000000000"),
        headers=headers(data["pro"]),
        json=TRANSLATION,
    )
    with application.state.database.session() as session:
        actor = session.get(User, data["pro"].id)
        assert actor is not None
        ExerciseGovernanceService(session).revoke(
            actor, UUID(imported["id"]), "test://revoke"
        )
    withdrawn = client.put(
        _path(imported["id"]), headers=headers(data["pro"]), json=TRANSLATION
    )

    assert unknown.status_code == 404
    assert unknown.json()["code"] == "exercise_not_found"
    assert withdrawn.status_code == 404
    assert withdrawn.json()["code"] == "exercise_not_found"


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"name": "Nome"},
        {"instructions": ["Passo."]},
        {"name": "", "instructions": ["Passo."]},
        {"name": "   ", "instructions": ["Passo."]},
        {"name": "x" * 201, "instructions": ["Passo."]},
        {"name": "Nome", "instructions": []},
        {"name": "Nome", "instructions": ["  "]},
        {"name": "Nome", "instructions": ["Linha um\nlinha dois"]},
        {"name": "Nome", "instructions": ["x" * 2001]},
        {"name": "Nome", "instructions": ["Passo."] * 51},
        {"name": "Nome", "instructions": "Passo."},
        {"name": None, "instructions": None},
        {"name": "Nome", "instructions": ["Passo."], "rule_version": "x"},
    ],
)
def test_invalid_localization_returns_422(
    client: TestClient, imported: dict, data, headers, body: dict
) -> None:
    response = client.put(
        _path(imported["id"]), headers=headers(data["pro"]), json=body
    )

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


def test_import_can_include_translation(
    client: TestClient, application: FastAPI, provider: FakeProvider, data, headers
) -> None:
    response = client.post(
        URL,
        headers=headers(data["pro"]),
        json={
            "allowed_sides": ["left"],
            "name_pt_br": "  Teste fictício ",
            "instructions_pt_br": [" Passo um.", "Passo dois. "],
        },
    )
    again = client.post(
        URL,
        headers=headers(data["other"]),
        json={
            "allowed_sides": ["right"],
            "name_pt_br": "Ignorado",
            "instructions_pt_br": ["Ignorado."],
        },
    )

    assert response.status_code == 201, response.text
    localization = response.json()["localization"]
    assert (
        localization["name"],
        localization["instructions"],
        localization["translated_by_name"],
    ) == ("Teste fictício", STORED_STEPS, TRANSLATOR_FALLBACK_NAME)
    assert response.json()["source"]["attribution"].startswith("Adapted from")
    # An existing exercise is never overwritten, translation included.
    assert again.status_code == 200
    assert again.json()["localization"] == localization


@pytest.mark.parametrize(
    "extra",
    [
        {"name_pt_br": "Só o nome"},
        {"instructions_pt_br": ["Só os passos."]},
        {"name_pt_br": "Nome", "instructions_pt_br": []},
        {"name_pt_br": "", "instructions_pt_br": ["Passo."]},
    ],
)
def test_import_rejects_partial_translation_before_provider(
    client: TestClient, provider: FakeProvider, data, headers, extra: dict
) -> None:
    response = client.post(
        URL, headers=headers(data["pro"]), json={"allowed_sides": ["left"], **extra}
    )

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert provider.calls == []


def test_partial_localization_is_rejected_by_the_database(
    application: FastAPI, data
) -> None:
    with pytest.raises(IntegrityError):
        with application.state.database.session() as session:
            exercise = session.get(Exercise, data["exercise"].id)
            assert exercise is not None
            exercise.name_pt_br = "Parcial"
            session.flush()


def _publish(client: TestClient, data, headers, exercise_id: str) -> dict:
    draft = client.post(
        f"/api/v1/patients/{data['patient'].id}/workouts",
        headers=headers(data["pro"]),
        json={
            "instructions": "Test prescription",
            "items": [
                {
                    "position": 1,
                    "exercise_id": exercise_id,
                    "side": "left",
                    "sets": 1,
                    "repetitions": 1,
                    "rest_duration_ms": 0,
                    "parameters": {},
                }
            ],
        },
    )
    assert draft.status_code == 201, draft.text
    published = client.post(
        f"/api/v1/workouts/{draft.json()['id']}/publish", headers=headers(data["pro"])
    )
    assert published.status_code == 200, published.text
    return published.json()


def test_published_snapshot_carries_images_and_localization_only_when_new(
    client: TestClient, imported: dict, data, headers
) -> None:
    old = _publish(client, data, headers, imported["id"])
    [old_item] = old["items"]
    assert old_item["exercise_snapshot"]["images"] == imported["images"] != []
    assert old_item["exercise_snapshot"]["localization"] is None

    translated = client.put(
        _path(imported["id"]), headers=headers(data["pro"]), json=TRANSLATION
    ).json()
    new = _publish(client, data, headers, imported["id"])
    mine = client.get("/api/v1/me/workouts", headers=headers(data["patient_user"]))
    snapshots = {
        workout["id"]: workout["items"][0]["exercise_snapshot"]
        for workout in mine.json()["items"]
    }

    assert snapshots[old["id"]] == old_item["exercise_snapshot"]
    assert snapshots[new["id"]]["localization"] == translated["localization"]
    assert snapshots[new["id"]]["images"] == imported["images"]
    assert snapshots[new["id"]]["source"] == translated["source"]
