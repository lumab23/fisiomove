"""Library images copied at import time (DEC-010); fake provider, no network."""

import hashlib
import logging
from collections.abc import Generator
from dataclasses import replace
from email.message import Message
from typing import Any
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.modules.auth.models import User
from app.modules.exercise_library import cli, providers
from app.modules.exercise_library.providers import (
    ExternalImageRejectedError,
    ExternalLibraryUnavailableError,
    FetchedImage,
    OpenExerciseBaseProvider,
    urllib_image_fetcher,
)
from app.modules.exercise_library.router import get_exercise_library_provider
from app.modules.exercises.models import (
    MAX_IMAGE_BYTES,
    Exercise,
    ExerciseApprovalEvent,
    ExerciseImage,
)
from app.modules.exercises.services import ExerciseGovernanceService
from tests.exercise_library.test_routes import DETAIL, PNG_BYTES, FakeProvider

URL = f"/api/v1/exercise-library/{DETAIL.external_id}/catalog"
IMAGE_PREFIX = f"https://images.example.test/{DETAIL.external_id}/"
JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"fictional-test-image"
WEBP_BYTES = b"RIFF\x10\x00\x00\x00WEBP" + b"fictional-test-image"


def _url(number: int) -> str:
    return f"{IMAGE_PREFIX}image_{number}.png"


@pytest.fixture
def provider(application: FastAPI) -> Generator[FakeProvider, None, None]:
    fake = FakeProvider()
    application.dependency_overrides[get_exercise_library_provider] = lambda: fake
    yield fake
    application.dependency_overrides.clear()


def _with_images(
    provider: FakeProvider,
    monkeypatch: pytest.MonkeyPatch,
    outcomes: list[FetchedImage | Exception | None],
) -> list[str]:
    urls = [_url(number) for number in range(1, len(outcomes) + 1)]
    detail = replace(DETAIL, image_urls=tuple(urls))
    original = provider.get_exercise

    def get_exercise(external_id: str):
        found = original(external_id)
        return detail if found is not None else None

    monkeypatch.setattr(provider, "get_exercise", get_exercise)
    provider.images = dict(zip(urls, outcomes, strict=True))
    return urls


def _stored(application: FastAPI, exercise_id: str) -> list[tuple[Any, ...]]:
    with application.state.database.session() as session:
        return [
            (
                image.position,
                image.content_type,
                image.byte_size,
                image.sha256,
                image.source_url,
                image.data,
            )
            for image in session.scalars(
                select(ExerciseImage)
                .where(ExerciseImage.exercise_id == UUID(str(exercise_id)))
                .order_by(ExerciseImage.position)
            )
        ]


def _add(client: TestClient, user: User, headers) -> Any:
    return client.post(URL, headers=headers(user), json={"allowed_sides": ["left"]})


def test_import_stores_at_most_six_valid_images_in_source_order(
    client: TestClient,
    application: FastAPI,
    provider: FakeProvider,
    data,
    headers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    contents = [PNG_BYTES, JPEG_BYTES, WEBP_BYTES] * 3  # 9 source images
    types = ["image/png", "image/jpeg", "image/webp; charset=binary"] * 3
    urls = _with_images(
        provider,
        monkeypatch,
        [FetchedImage(c, t) for c, t in zip(contents, types, strict=True)],
    )

    response = _add(client, data["pro"], headers)

    assert response.status_code == 201, response.text
    exercise_id = response.json()["id"]
    assert response.json()["images"] == [
        {"position": n, "url": f"/api/v1/exercises/{exercise_id}/images/{n}"}
        for n in range(1, 7)
    ]
    assert provider.image_calls == urls[:6]
    assert _stored(application, exercise_id) == [
        (
            n,
            types[n - 1].split(";")[0],
            len(contents[n - 1]),
            hashlib.sha256(contents[n - 1]).hexdigest(),
            urls[n - 1],
            contents[n - 1],
        )
        for n in range(1, 7)
    ]


@pytest.mark.parametrize(
    ("outcome", "reason"),
    [
        (ExternalImageRejectedError("foreign host"), "url_not_allowed"),
        # The https-only opener raises this for http redirects and timeouts.
        (
            ExternalLibraryUnavailableError("Refusing non-https redirect"),
            "download_failed",
        ),
        (FetchedImage(b"x" * (MAX_IMAGE_BYTES + 1), "image/png"), "download_failed"),
        (None, "not_found"),
        (FetchedImage(b"", "image/png"), "invalid_size"),
        (FetchedImage(b"<svg/>", "image/svg+xml"), "content_type_not_allowed"),
        (FetchedImage(PNG_BYTES, "text/html"), "content_type_not_allowed"),
        (FetchedImage(PNG_BYTES, ""), "content_type_not_allowed"),
        (FetchedImage(JPEG_BYTES, "image/png"), "content_mismatch"),
        (FetchedImage(b"GIF89a-fictional", "image/webp"), "content_mismatch"),
    ],
)
def test_invalid_image_is_skipped_and_logged_without_failing_import(
    client: TestClient,
    application: FastAPI,
    provider: FakeProvider,
    data,
    headers,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    outcome: FetchedImage | Exception | None,
    reason: str,
) -> None:
    urls = _with_images(
        provider, monkeypatch, [outcome, FetchedImage(PNG_BYTES, "image/png")]
    )

    with caplog.at_level(logging.WARNING, logger="fisiomove.exercise_library"):
        response = _add(client, data["pro"], headers)

    assert response.status_code == 201, response.text
    exercise_id = response.json()["id"]
    assert [image["position"] for image in response.json()["images"]] == [1]
    [stored] = _stored(application, exercise_id)
    assert (stored[0], stored[4]) == (1, urls[1])
    skipped = [r for r in caplog.records if r.getMessage() == "library_image_skipped"]
    assert [(r.error_type, r.image_position) for r in skipped] == [(reason, 1)]


def test_import_without_any_valid_image_still_adds_the_exercise(
    client: TestClient,
    application: FastAPI,
    provider: FakeProvider,
    data,
    headers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _with_images(provider, monkeypatch, [ExternalLibraryUnavailableError("timeout")])

    response = _add(client, data["pro"], headers)

    assert response.status_code == 201, response.text
    assert response.json()["images"] == []
    assert response.json()["approval_status"] == "approved"
    assert _stored(application, response.json()["id"]) == []


def test_provider_downloads_only_allowlisted_image_urls() -> None:
    fetched: list[tuple[str, int]] = []

    def fetch_image(url: str, max_bytes: int) -> FetchedImage:
        fetched.append((url, max_bytes))
        return FetchedImage(PNG_BYTES, "image/png")

    provider = OpenExerciseBaseProvider(
        list_url="https://library.example.test/api/exercises",
        detail_base_url="https://raw.example.test/exercises",
        image_base_url="https://raw.example.test/images",
        fetch=lambda url, max_bytes: None,
        fetch_image=fetch_image,
    )
    allowed = "https://raw.example.test/images/EX-a-01/image_1.png"
    for url in (
        "https://evil.example.test/images/EX-a-01/image_1.png",
        "http://raw.example.test/images/EX-a-01/image_1.png",
        "https://raw.example.test/images/EX-b-01/image_1.png",
        "https://raw.example.test/images/EX-a-01/../x/image_1.png",
        "image_1.png",
    ):
        with pytest.raises(ExternalImageRejectedError):
            provider.get_image("EX-a-01", url, 10)

    assert provider.get_image("EX-a-01", allowed, 10) == FetchedImage(
        PNG_BYTES, "image/png"
    )
    assert fetched == [(allowed, 10)]


def test_urllib_image_fetcher_uses_https_only_opener(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: dict[str, Any] = {}

    class _Response:
        def __init__(self, body: bytes, content_type: str) -> None:
            self._body = body
            self.headers = Message()
            self.headers["Content-Type"] = content_type

        def read(self, size: int) -> bytes:
            return self._body[:size]

        def __enter__(self) -> "_Response":
            return self

        def __exit__(self, *_: object) -> None:
            return None

    bodies = [PNG_BYTES, b"x" * 11]

    def fake_open(request: Any, timeout: float) -> _Response:
        seen.update(
            url=request.full_url, accept=request.get_header("Accept"), timeout=timeout
        )
        return _Response(bodies.pop(0), "image/png")

    monkeypatch.setattr(providers, "_open", fake_open)
    fetch = urllib_image_fetcher(3.0)

    assert fetch("https://raw.example.test/i.png", 100) == FetchedImage(
        PNG_BYTES, "image/png"
    )
    assert seen == {
        "url": "https://raw.example.test/i.png",
        "accept": "image/png, image/jpeg, image/webp",
        "timeout": 3.0,
    }
    with pytest.raises(ExternalLibraryUnavailableError):
        fetch("https://raw.example.test/i.png", 10)


def test_image_route_serves_bytes_to_authenticated_accounts(
    client: TestClient,
    application: FastAPI,
    provider: FakeProvider,
    data,
    headers,
) -> None:
    exercise_id = _add(client, data["pro"], headers).json()["id"]
    path = f"/api/v1/exercises/{exercise_id}/images/1"

    for user in (data["patient_user"], data["other"]):
        response = client.get(path, headers=headers(user))
        assert response.status_code == 200
        assert response.content == PNG_BYTES
        assert response.headers["content-type"] == "image/png"
        assert response.headers["cache-control"] == "private, max-age=86400"
        assert response.headers["etag"] == (
            f'"{hashlib.sha256(PNG_BYTES).hexdigest()}"'
        )
        assert response.headers["x-content-type-options"] == "nosniff"


def test_image_route_errors(
    client: TestClient,
    application: FastAPI,
    provider: FakeProvider,
    data,
    headers,
) -> None:
    exercise_id = _add(client, data["pro"], headers).json()["id"]
    path = f"/api/v1/exercises/{exercise_id}/images"

    anonymous = client.get(f"{path}/1")
    missing = client.get(f"{path}/2", headers=headers(data["patient_user"]))
    unknown = client.get(
        f"/api/v1/exercises/{data['exercise'].id}/images/1",
        headers=headers(data["pro"]),
    )
    beyond = client.get(f"{path}/7", headers=headers(data["pro"]))
    with application.state.database.session() as session:
        patient = session.get(User, data["patient_user"].id)
        assert patient is not None
        patient.must_change_password = True
        session.flush()
        session.expunge(patient)
    temporary = client.get(f"{path}/1", headers=headers(patient))

    assert anonymous.status_code == 401
    assert anonymous.json()["code"] == "authentication_required"
    assert missing.status_code == 404
    assert missing.json()["code"] == "exercise_image_not_found"
    assert missing.headers["cache-control"] == "no-store"
    assert unknown.status_code == 404
    assert unknown.json()["code"] == "exercise_image_not_found"
    assert beyond.status_code == 422
    assert beyond.json()["code"] == "validation_error"
    assert temporary.status_code == 403
    assert temporary.json()["code"] == "password_change_required"


def test_image_of_withdrawn_exercise_still_serves_published_snapshots(
    client: TestClient,
    application: FastAPI,
    provider: FakeProvider,
    data,
    headers,
) -> None:
    exercise_id = _add(client, data["pro"], headers).json()["id"]
    with application.state.database.session() as session:
        actor = session.get(User, data["pro"].id)
        assert actor is not None
        ExerciseGovernanceService(session).revoke(
            actor, UUID(exercise_id), "test://revoke"
        )

    hidden = client.get(
        f"/api/v1/exercises/{exercise_id}", headers=headers(data["patient_user"])
    )
    image = client.get(
        f"/api/v1/exercises/{exercise_id}/images/1",
        headers=headers(data["patient_user"]),
    )

    assert hidden.status_code == 404
    assert image.status_code == 200
    assert image.content == PNG_BYTES


def _snapshot(application: FastAPI, exercise_id: str) -> tuple[Any, ...]:
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
            exercise.allowed_sides,
            exercise.approval_status,
            exercise.approved_rule_version,
            exercise.approved_by_id,
            exercise.name_pt_br,
            events,
        )


def test_backfill_stores_missing_images_once(
    client: TestClient,
    application: FastAPI,
    provider: FakeProvider,
    data,
    headers,
    capsys: pytest.CaptureFixture[str],
) -> None:
    images = provider.images
    provider.images = {}
    exercise_id = _add(client, data["pro"], headers).json()["id"]
    before = _snapshot(application, exercise_id)
    assert _stored(application, exercise_id) == []
    provider.images = images
    provider.image_calls.clear()
    database = application.state.database

    first = cli.main(["backfill-images"], database=database, provider=provider)
    stored = _stored(application, exercise_id)
    second = cli.main(["backfill-images"], database=database, provider=provider)

    assert (first, second) == (0, 0)
    assert [(row[0], row[1], row[5]) for row in stored] == [(1, "image/png", PNG_BYTES)]
    assert _stored(application, exercise_id) == stored
    assert provider.image_calls == [DETAIL.image_urls[0]]
    assert _snapshot(application, exercise_id) == before
    output = capsys.readouterr().out
    assert "Exercises updated: 1" in output
    assert "Exercises updated: 0" in output
    # The fixture exercise has no provenance and is never considered.
    assert _stored(application, str(data["exercise"].id)) == []
    response = client.get(
        f"/api/v1/exercises/{exercise_id}", headers=headers(data["pro"])
    )
    assert response.json()["images"] == [
        {"position": 1, "url": f"/api/v1/exercises/{exercise_id}/images/1"}
    ]


def test_backfill_reports_unavailable_and_missing_sources(
    client: TestClient,
    application: FastAPI,
    provider: FakeProvider,
    data,
    headers,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    provider.images = {}
    exercise_id = _add(client, data["pro"], headers).json()["id"]
    database = application.state.database

    no_image = cli.main(["backfill-images"], database=database, provider=provider)
    monkeypatch.setattr(provider, "get_exercise", lambda _: None)
    gone = cli.main(["backfill-images"], database=database, provider=provider)
    provider.fail = True
    monkeypatch.setattr(
        provider,
        "get_exercise",
        lambda _: (_ for _ in ()).throw(ExternalLibraryUnavailableError("down")),
    )
    down = cli.main(["backfill-images"], database=database, provider=provider)

    assert (no_image, gone, down) == (0, 0, 1)
    output = capsys.readouterr().out
    assert f"no valid image: {exercise_id}" in output
    assert f"not found: {exercise_id}" in output
    assert f"unavailable: {exercise_id}" in output
    assert _stored(application, exercise_id) == []
