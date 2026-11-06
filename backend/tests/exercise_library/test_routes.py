"""Route tests with a fake provider; no network access."""

from collections.abc import Generator, Sequence
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.modules.auth.models import User
from app.modules.exercise_library.providers import (
    ExternalLibraryUnavailableError,
    FetchedImage,
    LibraryExerciseDetail,
    LibraryExerciseSummary,
    LibraryInstructionStep,
    OpenExerciseBaseProvider,
)
from app.modules.exercise_library.router import get_exercise_library_provider
from app.modules.exercise_library.schemas import USAGE_NOTICE
from app.modules.exercises.models import Exercise

BASE = "/api/v1/exercise-library"
LIST_URL = "https://library.example.test/api/exercises"
DETAIL_URL = "https://library.example.test/exercises/EX-shoulder-press-01.json"
ATTRIBUTION = {
    "source": (
        "OpenExerciseBase (Ludwig Boltzmann Institute for Digital Health and "
        "Prevention)"
    ),
    "license": "CC BY-NC 4.0",
    "license_url": "https://creativecommons.org/licenses/by-nc/4.0/",
    "changes": (
        "Only selected descriptive fields are shown; text is kept in the original "
        "language without edits. Performance metrics and variations are omitted."
    ),
}


def _summary(external_id: str, name: str, body_parts: tuple[str, ...]):
    return LibraryExerciseSummary(
        external_id=external_id,
        name=name,
        categories=("mobility",),
        body_parts=body_parts,
        equipment=(),
        image_url=f"https://images.example.test/{external_id}/image_1.png",
        review_status="accepted",
    )


ITEMS = (
    _summary("EX-wall-push-01", "Wall Push", ("chest", "upper_back")),
    _summary("EX-shoulder-press-01", "Shoulder Press", ("shoulders", "arms")),
    _summary("EX-arm-circle-01", "arm circles", ("Shoulders", "full body")),
)
DETAIL = LibraryExerciseDetail(
    external_id="EX-shoulder-press-01",
    name="Shoulder Press",
    categories=("mobility",),
    body_parts=("shoulders", "arms"),
    equipment=("chair",),
    instructions=(
        LibraryInstructionStep(1, "Sit on a chair."),
        LibraryInstructionStep(2, "Raise both arms."),
    ),
    image_urls=("https://images.example.test/EX-shoulder-press-01/image_1.png",),
    review_status="accepted_with_edits",
    created_by="professional",
    source_url=DETAIL_URL,
)


IMAGE_URL = DETAIL.image_urls[0]
# Fictional bytes with a real PNG signature; not an exercise illustration.
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"fictional-test-image"


class FakeProvider:
    list_source_url = LIST_URL

    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.calls: list[str] = []
        self.image_calls: list[str] = []
        self.images: dict[str, FetchedImage | Exception | None] = {
            IMAGE_URL: FetchedImage(PNG_BYTES, "image/png")
        }

    def get_image(
        self, external_id: str, url: str, max_bytes: int
    ) -> FetchedImage | None:
        self.image_calls.append(url)
        outcome = self.images.get(url)
        if isinstance(outcome, Exception):
            raise outcome
        if outcome is not None and len(outcome.content) > max_bytes:
            raise ExternalLibraryUnavailableError("Response too large")
        return outcome

    def list_exercises(self) -> Sequence[LibraryExerciseSummary]:
        self.calls.append("list")
        if self.fail:
            raise ExternalLibraryUnavailableError("timeout")
        return ITEMS

    def get_exercise(self, external_id: str) -> LibraryExerciseDetail | None:
        self.calls.append(f"get:{external_id}")
        if self.fail:
            raise ExternalLibraryUnavailableError("timeout")
        return DETAIL if external_id == DETAIL.external_id else None


@pytest.fixture
def provider(application: FastAPI) -> Generator[FakeProvider, None, None]:
    fake = FakeProvider()
    application.dependency_overrides[get_exercise_library_provider] = lambda: fake
    yield fake
    application.dependency_overrides.clear()


def _names(response) -> list[str]:
    return [item["name"] for item in response.json()["items"]]


def test_search_lists_sorted_page_with_attribution(
    client: TestClient, provider: FakeProvider, data, headers
) -> None:
    response = client.get(BASE, headers=headers(data["pro"]))

    assert response.status_code == 200
    body = response.json()
    assert _names(response) == ["arm circles", "Shoulder Press", "Wall Push"]
    assert (body["page"], body["page_size"], body["total"], body["pages"]) == (
        1,
        20,
        3,
        1,
    )
    assert body["usage_notice"] == USAGE_NOTICE
    assert body["attribution"] == {**ATTRIBUTION, "source_url": LIST_URL}
    assert body["items"][1] == {
        "external_id": "EX-shoulder-press-01",
        "name": "Shoulder Press",
        "categories": ["mobility"],
        "body_parts": ["shoulders", "arms"],
        "equipment": [],
        "image_url": "https://images.example.test/EX-shoulder-press-01/image_1.png",
        "review_status": "accepted",
    }


def test_search_filters_by_query_and_body_part(
    client: TestClient, provider: FakeProvider, data, headers
) -> None:
    auth = headers(data["pro"])

    assert _names(client.get(BASE, headers=auth, params={"query": "PRESS"})) == [
        "Shoulder Press"
    ]
    assert _names(
        client.get(BASE, headers=auth, params={"body_part": "shoulders"})
    ) == ["arm circles", "Shoulder Press"]
    assert _names(
        client.get(BASE, headers=auth, params={"body_part": "Upper Back"})
    ) == ["Wall Push"]
    assert _names(
        client.get(BASE, headers=auth, params={"body_part": "full_body"})
    ) == ["arm circles"]
    assert _names(
        client.get(
            BASE, headers=auth, params={"query": "arm", "body_part": "shoulders"}
        )
    ) == ["arm circles"]
    assert _names(
        client.get(BASE, headers=auth, params={"query": "", "body_part": ""})
    ) == ["arm circles", "Shoulder Press", "Wall Push"]
    empty = client.get(BASE, headers=auth, params={"query": "unknown"}).json()
    assert (empty["items"], empty["total"], empty["pages"]) == ([], 0, 0)


def test_search_paginates_on_server(
    client: TestClient, provider: FakeProvider, data, headers
) -> None:
    auth = headers(data["pro"])

    second = client.get(BASE, headers=auth, params={"page": 2, "page_size": 2})
    beyond = client.get(BASE, headers=auth, params={"page": 5, "page_size": 2})
    invalid = client.get(BASE, headers=auth, params={"page_size": 101})

    assert _names(second) == ["Wall Push"]
    assert (second.json()["total"], second.json()["pages"]) == (3, 2)
    assert beyond.json()["items"] == []
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "validation_error"


def test_detail_exposes_only_reference_fields(
    client: TestClient, provider: FakeProvider, data, headers
) -> None:
    response = client.get(f"{BASE}/EX-shoulder-press-01", headers=headers(data["pro"]))

    assert response.status_code == 200
    assert response.json() == {
        "external_id": "EX-shoulder-press-01",
        "name": "Shoulder Press",
        "categories": ["mobility"],
        "body_parts": ["shoulders", "arms"],
        "equipment": ["chair"],
        "instructions": [
            {"step_number": 1, "description": "Sit on a chair."},
            {"step_number": 2, "description": "Raise both arms."},
        ],
        "instructions_language": "en",
        "image_urls": ["https://images.example.test/EX-shoulder-press-01/image_1.png"],
        "review_status": "accepted_with_edits",
        "created_by": "professional",
        "usage_notice": USAGE_NOTICE,
        "attribution": {**ATTRIBUTION, "source_url": DETAIL_URL},
        "catalog_exercise": None,
    }


def test_unknown_detail_returns_404(
    client: TestClient, provider: FakeProvider, data, headers
) -> None:
    response = client.get(f"{BASE}/EX-missing-01", headers=headers(data["pro"]))

    assert response.status_code == 404
    assert response.json()["code"] == "library_exercise_not_found"


def test_detail_rejects_malformed_ids_before_provider(
    client: TestClient, provider: FakeProvider, data, headers
) -> None:
    for external_id in ("bad.id", "-leading-dash", "a" * 129, "EX%20space"):
        response = client.get(f"{BASE}/{external_id}", headers=headers(data["pro"]))
        assert response.status_code == 422, external_id
        assert response.json()["code"] == "validation_error"

    assert provider.calls == []


def test_provider_failure_returns_503(
    client: TestClient, provider: FakeProvider, data, headers
) -> None:
    provider.fail = True

    for path in (BASE, f"{BASE}/EX-shoulder-press-01"):
        response = client.get(path, headers=headers(data["pro"]))
        assert response.status_code == 503
        assert response.json()["code"] == "external_library_unavailable"
        assert response.headers["Retry-After"] == "30"


def test_disabled_library_returns_503(
    client: TestClient, application: FastAPI, data, headers
) -> None:
    application.state.settings = application.state.settings.model_copy(
        update={"exercise_library_enabled": False}
    )

    response = client.get(BASE, headers=headers(data["pro"]))

    assert response.status_code == 503
    assert response.json()["code"] == "external_library_unavailable"
    assert response.json()["message"] == "The external exercise library is disabled."


def test_patient_is_forbidden(
    client: TestClient, provider: FakeProvider, data, headers
) -> None:
    for path in (BASE, f"{BASE}/EX-shoulder-press-01"):
        response = client.get(path, headers=headers(data["patient_user"]))
        assert response.status_code == 403
        assert response.json()["code"] == "insufficient_role"

    assert provider.calls == []


def test_requires_authentication_and_changed_password(
    client: TestClient, application: FastAPI, provider: FakeProvider, data, headers
) -> None:
    anonymous = client.get(BASE)
    with application.state.database.session() as session:
        professional = session.get(User, data["pro"].id)
        assert professional is not None
        professional.must_change_password = True
        session.flush()
        session.expunge(professional)
    temporary = client.get(BASE, headers=headers(professional))

    assert anonymous.status_code == 401
    assert anonymous.json()["code"] == "authentication_required"
    assert temporary.status_code == 403
    assert temporary.json()["code"] == "password_change_required"
    assert provider.calls == []


def test_browsing_the_library_does_not_change_the_catalog(
    client: TestClient, application: FastAPI, provider: FakeProvider, data, headers
) -> None:
    """Only `POST /exercise-library/{external_id}/catalog` writes to `exercises`."""
    auth = headers(data["pro"])
    client.get(BASE, headers=auth)
    client.get(f"{BASE}/EX-shoulder-press-01", headers=auth)

    catalog = client.get("/api/v1/exercises", headers=auth)
    missing = client.get("/api/v1/exercises/EX-shoulder-press-01", headers=auth)

    assert catalog.status_code == 200
    assert [item["id"] for item in catalog.json()["items"]] == [
        str(data["exercise"].id)
    ]
    assert catalog.json()["total"] == 1
    assert missing.status_code == 422
    with application.state.database.session() as session:
        assert session.query(Exercise).count() == 1


def test_default_provider_is_built_once_from_settings(application: FastAPI) -> None:
    request = SimpleNamespace(app=application)

    first = get_exercise_library_provider(request)  # type: ignore[arg-type]
    second = get_exercise_library_provider(request)  # type: ignore[arg-type]

    assert isinstance(first, OpenExerciseBaseProvider)
    assert first is second
    assert first.list_source_url == (
        "https://www.openexercisedatabase.at/api/exercises"
    )
