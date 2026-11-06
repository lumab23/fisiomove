"""Provider protocol and the OpenExerciseBase adapter.

Only identification, descriptive and attribution fields are mapped. Fields that
could read as prescription (`performanceMetrics`, `variations`, effects,
relationships, comments) are deliberately never read.
"""

import http.client
import json
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

from app.core.config import Settings

EXTERNAL_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$"
_EXTERNAL_ID = re.compile(EXTERNAL_ID_PATTERN)
_IMAGE_FILE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,100}\.[A-Za-z0-9]{1,10}$")
MAX_LIST_BYTES = 5 * 1024 * 1024
MAX_DETAIL_BYTES = 1024 * 1024


class ExternalLibraryUnavailableError(Exception):
    """The provider failed, timed out or answered with an unusable payload."""


@dataclass(frozen=True)
class LibraryExerciseSummary:
    external_id: str
    name: str
    categories: tuple[str, ...]
    body_parts: tuple[str, ...]
    equipment: tuple[str, ...]
    image_url: str | None
    review_status: str | None


@dataclass(frozen=True)
class LibraryInstructionStep:
    step_number: int
    description: str


@dataclass(frozen=True)
class LibraryExerciseDetail:
    external_id: str
    name: str
    categories: tuple[str, ...]
    body_parts: tuple[str, ...]
    equipment: tuple[str, ...]
    instructions: tuple[LibraryInstructionStep, ...]
    image_urls: tuple[str, ...]
    review_status: str | None
    created_by: str | None
    source_url: str


@dataclass(frozen=True)
class FetchedImage:
    """Raw bytes and the declared Content-Type; validated by the caller."""

    content: bytes
    content_type: str


class ExternalImageRejectedError(Exception):
    """The image URL is outside the provider's image allowlist."""


class ExerciseLibraryProvider(Protocol):
    @property
    def list_source_url(self) -> str: ...

    def list_exercises(self) -> Sequence[LibraryExerciseSummary]:
        """Return every exercise eligible as reference material."""
        ...

    def get_exercise(self, external_id: str) -> LibraryExerciseDetail | None:
        """Return one eligible exercise, or None when it does not exist."""
        ...

    def get_image(
        self, external_id: str, url: str, max_bytes: int
    ) -> FetchedImage | None:
        """Download one image of `external_id`; None when it does not exist.

        Raises `ExternalImageRejectedError` for URLs outside the allowlist and
        `ExternalLibraryUnavailableError` for network failures or oversize bodies.
        """
        ...


def is_valid_external_id(value: str) -> bool:
    return _EXTERNAL_ID.fullmatch(value) is not None


Fetcher = Callable[[str, int], bytes | None]
ImageFetcher = Callable[[str, int], FetchedImage | None]
IMAGE_ACCEPT = "image/png, image/jpeg, image/webp"


class _HttpsOnlyRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Follow redirects only to https on the same host as the original request.

    A 30x can neither downgrade to http/ftp nor move the request to another host
    (the allowlist only checks the first URL).
    """

    def redirect_request(  # type: ignore[no-untyped-def]
        self, req, fp, code, msg, headers, newurl
    ):
        target = urllib.parse.urlsplit(newurl)
        if target.scheme != "https":
            raise urllib.error.URLError("Refusing non-https redirect")
        origin_host = urllib.parse.urlsplit(req.full_url).hostname
        if target.hostname is None or target.hostname != origin_host:
            raise urllib.error.URLError("Refusing cross-host redirect")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_OPENER = urllib.request.build_opener(_HttpsOnlyRedirectHandler())


def _open(request: urllib.request.Request, timeout: float) -> Any:
    return _OPENER.open(request, timeout=timeout)


def _get(
    url: str, max_bytes: int, accept: str, timeout_seconds: float
) -> tuple[bytes, str] | None:
    """GET with the https-only opener; (body, Content-Type) or None on 404."""
    request = urllib.request.Request(
        url, headers={"Accept": accept, "User-Agent": "FisioMove-API"}
    )
    try:
        with _open(request, timeout_seconds) as response:
            body: bytes = response.read(max_bytes + 1)
            headers = getattr(response, "headers", None)
            content_type = (headers.get("Content-Type") if headers else None) or ""
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise ExternalLibraryUnavailableError(f"HTTP {exc.code}") from exc
    except (OSError, http.client.HTTPException, ValueError) as exc:
        # URLError and TimeoutError are OSError subclasses.
        raise ExternalLibraryUnavailableError(type(exc).__name__) from exc
    if len(body) > max_bytes:
        raise ExternalLibraryUnavailableError("Response too large")
    return body, content_type


def urllib_fetcher(timeout_seconds: float) -> Fetcher:
    """GET a URL with the standard library; None means HTTP 404."""

    def fetch(url: str, max_bytes: int) -> bytes | None:
        result = _get(url, max_bytes, "application/json", timeout_seconds)
        return None if result is None else result[0]

    return fetch


def urllib_image_fetcher(timeout_seconds: float) -> ImageFetcher:
    """GET an image with the same https-only opener and size cap."""

    def fetch(url: str, max_bytes: int) -> FetchedImage | None:
        result = _get(url, max_bytes, IMAGE_ACCEPT, timeout_seconds)
        return None if result is None else FetchedImage(result[0], result[1])

    return fetch


def _strings(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(item for item in value if isinstance(item, str) and item.strip())


def _optional_string(value: Any) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def _decode(body: bytes) -> Any:
    try:
        return json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ExternalLibraryUnavailableError("Invalid JSON") from exc


class OpenExerciseBaseProvider:
    """Live adapter for https://www.openexercisedatabase.at (validated track only)."""

    def __init__(
        self,
        *,
        list_url: str,
        detail_base_url: str,
        image_base_url: str,
        fetch: Fetcher,
        fetch_image: ImageFetcher | None = None,
        cache_seconds: int = 300,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._list_url = list_url
        self._detail_base_url = detail_base_url.rstrip("/")
        self._image_base_url = image_base_url.rstrip("/")
        self._fetch = fetch
        self._fetch_image = fetch_image
        self._cache_seconds = cache_seconds
        self._clock = clock
        self._lock = threading.Lock()
        self._cached: tuple[float, tuple[LibraryExerciseSummary, ...]] | None = None

    @property
    def list_source_url(self) -> str:
        return self._list_url

    def list_exercises(self) -> Sequence[LibraryExerciseSummary]:
        with self._lock:
            now = self._clock()
            if self._cached is not None and self._cached[0] > now:
                return self._cached[1]
        body = self._fetch(self._list_url, MAX_LIST_BYTES)
        if body is None:
            raise ExternalLibraryUnavailableError("List endpoint not found")
        items = self._parse_list(_decode(body))
        if self._cache_seconds > 0:
            with self._lock:
                self._cached = (self._clock() + self._cache_seconds, items)
        return items

    def get_exercise(self, external_id: str) -> LibraryExerciseDetail | None:
        if not is_valid_external_id(external_id):
            return None
        # The list is the allowlist: only the validated track may be detailed.
        if external_id not in {item.external_id for item in self.list_exercises()}:
            return None
        url = f"{self._detail_base_url}/{urllib.parse.quote(external_id)}.json"
        body = self._fetch(url, MAX_DETAIL_BYTES)
        if body is None:
            return None
        data = _decode(body)
        if not isinstance(data, dict):
            raise ExternalLibraryUnavailableError("Unexpected detail payload")
        name = _optional_string(data.get("name"))
        if data.get("id") != external_id or name is None:
            raise ExternalLibraryUnavailableError("Inconsistent detail payload")
        media = data.get("mediaContent")
        metadata = data.get("metadata")
        media = media if isinstance(media, dict) else {}
        metadata = metadata if isinstance(metadata, dict) else {}
        images = (
            self._image_url(external_id, value)
            for value in _strings(media.get("imageURLs"))
        )
        return LibraryExerciseDetail(
            external_id=external_id,
            name=name,
            categories=_strings(data.get("categories")),
            body_parts=_strings(data.get("bodyParts")),
            equipment=_strings(data.get("equipment")),
            instructions=self._instructions(data.get("instructions")),
            image_urls=tuple(url for url in images if url is not None),
            review_status=_optional_string(metadata.get("reviewStatus")),
            created_by=_optional_string(metadata.get("createdBy")),
            source_url=url,
        )

    def get_image(
        self, external_id: str, url: str, max_bytes: int
    ) -> FetchedImage | None:
        # Only `<image_base_url>/<external_id>/<file>` is ever downloaded.
        if not is_valid_external_id(external_id) or (
            self._image_url(external_id, url) != url
        ):
            raise ExternalImageRejectedError("Image URL outside the allowlist")
        if self._fetch_image is None:
            raise ExternalLibraryUnavailableError("Image download is not configured")
        return self._fetch_image(url, max_bytes)

    def _parse_list(self, data: Any) -> tuple[LibraryExerciseSummary, ...]:
        if not isinstance(data, dict) or not isinstance(data.get("validated"), list):
            raise ExternalLibraryUnavailableError("Unexpected list payload")
        items: list[LibraryExerciseSummary] = []
        for raw in data["validated"]:
            if not isinstance(raw, dict) or raw.get("track", "validated") != (
                "validated"
            ):
                continue
            external_id = raw.get("id")
            name = _optional_string(raw.get("name"))
            if not isinstance(external_id, str) or name is None:
                continue
            if not is_valid_external_id(external_id):
                continue
            image = raw.get("imageUrl")
            items.append(
                LibraryExerciseSummary(
                    external_id=external_id,
                    name=name,
                    categories=_strings(raw.get("categories")),
                    body_parts=_strings(raw.get("bodyParts")),
                    equipment=_strings(raw.get("equipment")),
                    image_url=self._image_url(external_id, image)
                    if isinstance(image, str)
                    else None,
                    review_status=_optional_string(raw.get("reviewStatus")),
                )
            )
        return tuple(items)

    def _image_url(self, external_id: str, value: str) -> str | None:
        """Accept a bare file name or a URL inside the configured image folder."""
        prefix = f"{self._image_base_url}/{external_id}/"
        file_name = value[len(prefix) :] if value.startswith(prefix) else value
        if _IMAGE_FILE.fullmatch(file_name) is None:
            return None
        return prefix + file_name

    @classmethod
    def from_settings(cls, settings: Settings) -> "OpenExerciseBaseProvider":
        timeout = settings.exercise_library_timeout_seconds
        return cls(
            list_url=settings.exercise_library_list_url,
            detail_base_url=settings.exercise_library_detail_base_url,
            image_base_url=settings.exercise_library_image_base_url,
            fetch=urllib_fetcher(timeout),
            fetch_image=urllib_image_fetcher(timeout),
            cache_seconds=settings.exercise_library_cache_seconds,
        )

    @staticmethod
    def _instructions(value: Any) -> tuple[LibraryInstructionStep, ...]:
        if not isinstance(value, list):
            return ()
        steps = [
            LibraryInstructionStep(step["stepNumber"], step["description"].strip())
            for step in value
            if isinstance(step, dict)
            and isinstance(step.get("stepNumber"), int)
            and not isinstance(step.get("stepNumber"), bool)
            and isinstance(step.get("description"), str)
            and step["description"].strip()
        ]
        return tuple(sorted(steps, key=lambda step: step.step_number))
