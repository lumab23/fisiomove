"""FisioMove team pt-BR translation of the library (DEC-011, revised).

Route tests use the fake provider and a fictional translation for its item;
the shipped file is only checked for shape and API limits.
"""

import json
import re
from collections.abc import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.modules.exercise_library import translations
from app.modules.exercise_library.router import get_exercise_library_provider
from app.modules.exercise_library.translations import (
    TRANSLATION_FILE,
    LibraryTranslation,
    source_fingerprint,
)
from app.modules.exercises.schemas import (
    LOCALIZED_MAX_STEPS,
    LOCALIZED_NAME_MAX_LENGTH,
    LOCALIZED_STEP_MAX_LENGTH,
)
from tests.exercise_library.test_routes import BASE, DETAIL, FakeProvider

ORIGINAL_STEPS = "1. Sit on a chair.\n2. Raise both arms."
FICTIONAL = LibraryTranslation(
    name="Elevação fictícia",
    instructions=("Passo fictício um.", "Passo fictício dois."),
    source_sha256=source_fingerprint(DETAIL.name, ORIGINAL_STEPS),
)
CATALOG = f"{BASE}/{DETAIL.external_id}/catalog"


@pytest.fixture
def provider(application: FastAPI) -> Generator[FakeProvider, None, None]:
    fake = FakeProvider()
    application.dependency_overrides[get_exercise_library_provider] = lambda: fake
    yield fake
    application.dependency_overrides.clear()


@pytest.fixture
def translated(monkeypatch: pytest.MonkeyPatch) -> LibraryTranslation:
    monkeypatch.setattr(
        translations, "_translations", lambda: {DETAIL.external_id: FICTIONAL}
    )
    return FICTIONAL


def test_shipped_file_fits_the_localization_limits() -> None:
    data = json.loads(TRANSLATION_FILE.read_text(encoding="utf-8"))

    assert len(data) == 191
    for external_id, item in data.items():
        assert set(item) == {"name", "instructions", "source_sha256"}, external_id
        assert 0 < len(item["name"]) <= LOCALIZED_NAME_MAX_LENGTH, external_id
        assert len(item["instructions"]) <= LOCALIZED_MAX_STEPS, external_id
        assert all(
            0 < len(step) <= LOCALIZED_STEP_MAX_LENGTH for step in item["instructions"]
        ), external_id
        assert re.fullmatch(r"[0-9a-f]{64}", item["source_sha256"]), external_id


def test_search_shows_and_finds_the_portuguese_name(
    client: TestClient, provider: FakeProvider, translated, data, headers
) -> None:
    auth = headers(data["pro"])

    for query in ("fictícia", "FICTICIA", "Shoulder"):
        response = client.get(BASE, headers=auth, params={"query": query})
        assert response.status_code == 200, query
        assert [item["name_pt_br"] for item in response.json()["items"]] == [
            "Elevação fictícia"
        ], query


def test_detail_has_portuguese_steps_with_the_same_numbering(
    client: TestClient, provider: FakeProvider, translated, data, headers
) -> None:
    body = client.get(
        f"{BASE}/{DETAIL.external_id}", headers=headers(data["pro"])
    ).json()

    assert body["name"] == DETAIL.name
    assert body["name_pt_br"] == "Elevação fictícia"
    assert body["instructions_pt_br"] == [
        {"step_number": 1, "description": "Passo fictício um."},
        {"step_number": 2, "description": "Passo fictício dois."},
    ]


def test_changed_source_text_falls_back_to_the_original(
    client: TestClient,
    provider: FakeProvider,
    monkeypatch: pytest.MonkeyPatch,
    data,
    headers,
) -> None:
    stale = LibraryTranslation(
        name=FICTIONAL.name,
        instructions=FICTIONAL.instructions,
        source_sha256=source_fingerprint(DETAIL.name, "1. Older text."),
    )
    monkeypatch.setattr(
        translations, "_translations", lambda: {DETAIL.external_id: stale}
    )
    auth = headers(data["pro"])

    detail = client.get(f"{BASE}/{DETAIL.external_id}", headers=auth).json()
    added = client.post(CATALOG, headers=auth, json={"allowed_sides": ["left"]})

    assert (detail["name_pt_br"], detail["instructions_pt_br"]) == (None, None)
    assert added.status_code == 201
    assert added.json()["localization"] is None


def test_catalog_exercise_gets_the_unreviewed_team_translation(
    client: TestClient, provider: FakeProvider, translated, data, headers
) -> None:
    response = client.post(
        CATALOG, headers=headers(data["pro"]), json={"allowed_sides": ["left"]}
    )

    assert response.status_code == 201, response.text
    body = response.json()
    # The original stays untouched; Portuguese is only the localization block.
    assert (body["name"], body["instructions"]) == (DETAIL.name, ORIGINAL_STEPS)
    assert body["localization"] == {
        "language": "pt-BR",
        "name": "Elevação fictícia",
        "instructions": "1. Passo fictício um.\n2. Passo fictício dois.",
        "translated_by_name": "equipe do FisioMove",
        "translated_at": "2026-11-21T00:00:00Z",
        "reviewed_by_physiotherapist": False,
    }
    assert body["source"]["attribution"].endswith(
        "translated into Portuguese by equipe do FisioMove on 2026-11-21 "
        "(not reviewed by a physiotherapist); the original English text is "
        "preserved."
    )


def test_physiotherapist_translation_replaces_the_team_translation(
    client: TestClient, provider: FakeProvider, translated, data, headers
) -> None:
    auth = headers(data["pro"])
    exercise_id = client.post(
        CATALOG, headers=auth, json={"allowed_sides": ["left"]}
    ).json()["id"]

    response = client.put(
        f"/api/v1/exercises/{exercise_id}/localization",
        headers=auth,
        json={"name": "Revisado fictício", "instructions": ["Passo revisado."]},
    )

    assert response.status_code == 200, response.text
    localization = response.json()["localization"]
    assert localization["name"] == "Revisado fictício"
    assert localization["reviewed_by_physiotherapist"] is True
