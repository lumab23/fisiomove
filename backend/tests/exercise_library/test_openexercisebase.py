"""OpenExerciseBase adapter tests with a fake fetcher; no network access."""

import io
import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import fields
from email.message import Message
from typing import Any

import pytest
from pydantic import ValidationError

from app.core.config import Environment, Settings
from app.modules.exercise_library import providers
from app.modules.exercise_library.providers import (
    ExternalLibraryUnavailableError,
    LibraryExerciseDetail,
    LibraryInstructionStep,
    OpenExerciseBaseProvider,
    urllib_fetcher,
)

LIST_URL = "https://library.example.test/api/exercises"
DETAIL_BASE = "https://raw.example.test/exercises"
IMAGE_BASE = "https://raw.example.test/images"
VALID_ID = "EX-ab-hold-01KZ3V3DYS3422TGERTFBDCBSP"
COMMUNITY_ID = "EX-community-only-01"

LIST_PAYLOAD = {
    "validated": [
        {
            "track": "validated",
            "id": VALID_ID,
            "name": "Ab Hold",
            "categories": ["strength_and_resistance"],
            "bodyParts": ["core", "hip_flexors"],
            "equipment": ["yoga mat"],
            "location": ["indoor"],
            "imageUrl": f"{IMAGE_BASE}/{VALID_ID}/image_1.png",
            "lastUpdated": "2026-09-04T11:51:44.375Z",
            "reviewStatus": "accepted",
        },
        {"track": "validated", "id": "../etc/passwd", "name": "Traversal"},
        {"track": "validated", "id": "EX-no-name-01"},
        {"track": "community", "id": "EX-mislabeled-01", "name": "Wrong track"},
        {
            "track": "validated",
            "id": "EX-foreign-image-01",
            "name": "Foreign image",
            "imageUrl": "https://evil.example.test/x.png",
        },
        "not-an-object",
    ],
    "community": [{"track": "community", "id": COMMUNITY_ID, "name": "Community"}],
    "communityError": False,
}
DETAIL_PAYLOAD = {
    "id": VALID_ID,
    "name": "Ab Hold",
    "categories": ["strength_and_resistance"],
    "exerciseEffects": ["prescription-like effect"],
    "bodyParts": ["core", "hip_flexors"],
    "equipment": ["yoga mat"],
    "location": ["indoor"],
    "instructions": [
        {"stepNumber": 2, "description": "Lift your upper back."},
        {"stepNumber": 1, "description": " Lie on your back. "},
        {"stepNumber": True, "description": "Boolean step"},
        {"description": "No number"},
    ],
    "performanceMetrics": {"sets": 3, "repetitions": 12, "duration": "30s"},
    "relationships": {"related": ["EX-other"]},
    "mediaContent": {
        "imageURLs": [
            "image_1.png",
            f"{IMAGE_BASE}/{VALID_ID}/image_2.png",
            "../../secret.png",
            "https://evil.example.test/image.png",
        ]
    },
    "metadata": {
        "createdBy": "professional",
        "reviewStatus": "accepted_with_edits",
        "reviewedBy": ["Open Exercise Team"],
    },
    "commentsNotes": "Increase to 20 repetitions",
    "variations": [{"name": "Harder variation", "repetitions": 20}],
}


class FakeFetcher:
    def __init__(self, responses: dict[str, Any]) -> None:
        self.responses = responses
        self.urls: list[str] = []

    def __call__(self, url: str, max_bytes: int) -> bytes | None:
        self.urls.append(url)
        value = self.responses.get(url)
        if isinstance(value, Exception):
            raise value
        if value is None or isinstance(value, bytes):
            return value
        return json.dumps(value).encode()


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def _provider(
    fetch: FakeFetcher, *, cache_seconds: int = 300, clock: Clock | None = None
) -> OpenExerciseBaseProvider:
    return OpenExerciseBaseProvider(
        list_url=LIST_URL,
        detail_base_url=DETAIL_BASE,
        image_base_url=IMAGE_BASE,
        fetch=fetch,
        cache_seconds=cache_seconds,
        clock=clock or Clock(),
    )


def _detail_url(external_id: str) -> str:
    return f"{DETAIL_BASE}/{external_id}.json"


def test_list_uses_only_valid_validated_items() -> None:
    items = _provider(FakeFetcher({LIST_URL: LIST_PAYLOAD})).list_exercises()

    assert [item.external_id for item in items] == [VALID_ID, "EX-foreign-image-01"]
    assert items[0].body_parts == ("core", "hip_flexors")
    assert items[0].image_url == f"{IMAGE_BASE}/{VALID_ID}/image_1.png"
    assert items[0].review_status == "accepted"
    assert items[1].image_url is None


def test_list_is_cached_until_expiry() -> None:
    fetch = FakeFetcher({LIST_URL: LIST_PAYLOAD})
    clock = Clock()
    provider = _provider(fetch, cache_seconds=60, clock=clock)

    provider.list_exercises()
    clock.now += 59
    provider.list_exercises()
    clock.now += 2
    provider.list_exercises()

    assert fetch.urls == [LIST_URL, LIST_URL]


def test_failures_are_not_cached() -> None:
    fetch = FakeFetcher({LIST_URL: ExternalLibraryUnavailableError("timeout")})
    provider = _provider(fetch)

    with pytest.raises(ExternalLibraryUnavailableError):
        provider.list_exercises()
    fetch.responses[LIST_URL] = LIST_PAYLOAD

    assert len(provider.list_exercises()) == 2


@pytest.mark.parametrize(
    "payload",
    [None, b"not json", b"\xff\xfe", [], {"validated": "nope"}, {"community": []}],
)
def test_unusable_list_payload_is_unavailable(payload: Any) -> None:
    with pytest.raises(ExternalLibraryUnavailableError):
        _provider(FakeFetcher({LIST_URL: payload})).list_exercises()


def test_detail_maps_reference_fields_and_ignores_prescription_like_ones() -> None:
    fetch = FakeFetcher({LIST_URL: LIST_PAYLOAD, _detail_url(VALID_ID): DETAIL_PAYLOAD})

    detail = _provider(fetch).get_exercise(VALID_ID)

    assert detail == LibraryExerciseDetail(
        external_id=VALID_ID,
        name="Ab Hold",
        categories=("strength_and_resistance",),
        body_parts=("core", "hip_flexors"),
        equipment=("yoga mat",),
        instructions=(
            LibraryInstructionStep(1, "Lie on your back."),
            LibraryInstructionStep(2, "Lift your upper back."),
        ),
        image_urls=(
            f"{IMAGE_BASE}/{VALID_ID}/image_1.png",
            f"{IMAGE_BASE}/{VALID_ID}/image_2.png",
        ),
        review_status="accepted_with_edits",
        created_by="professional",
        source_url=_detail_url(VALID_ID),
    )
    names = {field.name for field in fields(LibraryExerciseDetail)}
    assert not names & {"performance_metrics", "variations", "exercise_effects"}
    assert "repetitions" not in repr(detail)
    assert "Harder variation" not in repr(detail)


def test_detail_only_for_validated_ids_without_fetching_others() -> None:
    fetch = FakeFetcher({LIST_URL: LIST_PAYLOAD})
    provider = _provider(fetch)

    assert provider.get_exercise(COMMUNITY_ID) is None
    assert provider.get_exercise("../../etc/passwd") is None
    assert all(url == LIST_URL for url in fetch.urls)


def test_detail_404_returns_none() -> None:
    fetch = FakeFetcher({LIST_URL: LIST_PAYLOAD, _detail_url(VALID_ID): None})

    assert _provider(fetch).get_exercise(VALID_ID) is None


@pytest.mark.parametrize(
    "payload",
    [
        b"not json",
        [],
        {**DETAIL_PAYLOAD, "id": "EX-other"},
        {**DETAIL_PAYLOAD, "name": ""},
    ],
)
def test_unusable_detail_is_unavailable(payload: Any) -> None:
    fetch = FakeFetcher({LIST_URL: LIST_PAYLOAD, _detail_url(VALID_ID): payload})

    with pytest.raises(ExternalLibraryUnavailableError):
        _provider(fetch).get_exercise(VALID_ID)


class _Response(io.BytesIO):
    def __enter__(self) -> "_Response":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


def _http_error(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(LIST_URL, code, "error", Message(), None)


def test_urllib_fetcher_maps_outcomes(monkeypatch: pytest.MonkeyPatch) -> None:
    outcomes: list[Any] = []
    seen: dict[str, Any] = {}

    def fake_urlopen(request: Any, timeout: float) -> Any:
        seen["timeout"] = timeout
        seen["url"] = request.full_url
        outcome = outcomes.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        return _Response(outcome)

    monkeypatch.setattr(providers, "_open", fake_urlopen)
    fetch = urllib_fetcher(2.5)

    outcomes.append(b'{"ok": true}')
    assert fetch(LIST_URL, 100) == b'{"ok": true}'
    assert seen == {"timeout": 2.5, "url": LIST_URL}

    outcomes.append(_http_error(404))
    assert fetch(LIST_URL, 100) is None

    for failure in (
        _http_error(500),
        urllib.error.URLError("unreachable"),
        TimeoutError("timed out"),
        b"x" * 101,
    ):
        outcomes.append(failure)
        with pytest.raises(ExternalLibraryUnavailableError):
            fetch(LIST_URL, 100)


def test_redirects_are_followed_only_to_https() -> None:
    handler = providers._HttpsOnlyRedirectHandler()
    request = urllib.request.Request(LIST_URL)
    origin_host = urllib.parse.urlsplit(LIST_URL).hostname
    for target in (
        f"http://{origin_host}/x",
        f"ftp://{origin_host}/x",
        "https://example.org/x",
        "https://127.0.0.1/x",
    ):
        with pytest.raises(urllib.error.URLError):
            handler.redirect_request(request, None, 302, "Found", Message(), target)
    same_host = f"https://{origin_host}/moved"
    followed = handler.redirect_request(
        request, None, 302, "Found", Message(), same_host
    )
    assert followed is not None and followed.full_url == same_host


def test_settings_require_https_library_urls() -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            environment=Environment.TEST,
            database_url="sqlite+pysqlite:///:memory:",
            auth_secret_key="tests-only-secret-key-with-at-least-32-characters",
            exercise_library_list_url="file:///etc/passwd",
        )
