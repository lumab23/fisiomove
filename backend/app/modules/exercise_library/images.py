"""Copy library images into `exercise_images` (DEC-010).

Images are complementary to the text, so an image that fails to download or
violates a limit is skipped and logged instead of failing the import: the
exercise is still added and `backfill-images` can retry it later (only while
the exercise has no stored image at all).
"""

import hashlib
import logging
from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError

from app.db.session import Database
from app.modules.exercise_library.providers import (
    ExerciseLibraryProvider,
    ExternalImageRejectedError,
    ExternalLibraryUnavailableError,
    LibraryExerciseDetail,
)
from app.modules.exercise_library.schemas import OPENEXERCISEBASE_SOURCE
from app.modules.exercises.models import (
    IMAGE_CONTENT_TYPES,
    MAX_IMAGE_BYTES,
    MAX_IMAGES_PER_EXERCISE,
    Exercise,
    ExerciseImage,
)

logger = logging.getLogger("fisiomove.exercise_library")


def sniff_content_type(content: bytes) -> str | None:
    """Image type from magic bytes, limited to the accepted formats."""
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def _declared_type(value: str) -> str:
    return value.split(";", 1)[0].strip().lower()


def _skip(reason: str, position: int) -> None:
    logger.warning(
        "library_image_skipped",
        extra={"error_type": reason, "image_position": position},
    )


def download_images(
    provider: ExerciseLibraryProvider, detail: LibraryExerciseDetail
) -> list[ExerciseImage]:
    """Fetch up to the first six source images; return unsaved, valid rows.

    Positions are contiguous (1..n) over the images kept, in source order.
    """
    urls = list(dict.fromkeys(detail.image_urls))[:MAX_IMAGES_PER_EXERCISE]
    images: list[ExerciseImage] = []
    for source_position, url in enumerate(urls, 1):
        try:
            fetched = provider.get_image(detail.external_id, url, MAX_IMAGE_BYTES)
        except ExternalImageRejectedError:
            _skip("url_not_allowed", source_position)
            continue
        except ExternalLibraryUnavailableError:
            # Network failure, non-https redirect or body above the limit.
            _skip("download_failed", source_position)
            continue
        if fetched is None:
            _skip("not_found", source_position)
            continue
        content = fetched.content
        if not content or len(content) > MAX_IMAGE_BYTES:
            _skip("invalid_size", source_position)
            continue
        declared = _declared_type(fetched.content_type)
        if declared not in IMAGE_CONTENT_TYPES:
            _skip("content_type_not_allowed", source_position)
            continue
        if sniff_content_type(content) != declared:
            _skip("content_mismatch", source_position)
            continue
        images.append(
            ExerciseImage(
                position=len(images) + 1,
                content_type=declared,
                sha256=hashlib.sha256(content).hexdigest(),
                source_url=url,
                data=content,
                byte_size=len(content),
            )
        )
    return images


@dataclass
class BackfillReport:
    updated: list[UUID] = field(default_factory=list)
    without_valid_images: list[UUID] = field(default_factory=list)
    not_found: list[UUID] = field(default_factory=list)
    unavailable: list[UUID] = field(default_factory=list)
    already_done: list[UUID] = field(default_factory=list)


def backfill_images(
    database: Database, provider: ExerciseLibraryProvider
) -> BackfillReport:
    """Store images for library exercises that have none; idempotent.

    Only `exercise_images` is written: name, text, sides and approval stay as
    they are. Each exercise is committed separately, so a later failure keeps
    the progress already made.
    """
    report = BackfillReport()
    with database.session() as session:
        candidates = [
            (row[0], row[1])
            for row in session.execute(
                select(Exercise.id, Exercise.source_external_id)
                .where(
                    Exercise.source == OPENEXERCISEBASE_SOURCE,
                    ~exists().where(ExerciseImage.exercise_id == Exercise.id),
                )
                .order_by(Exercise.created_at, Exercise.id)
            )
        ]
    for exercise_id, external_id in candidates:
        if external_id is None:  # pragma: no cover - provenance is all-or-none
            continue
        try:
            detail = provider.get_exercise(external_id)
        except ExternalLibraryUnavailableError:
            report.unavailable.append(exercise_id)
            continue
        if detail is None:
            report.not_found.append(exercise_id)
            continue
        images = download_images(provider, detail)
        if not images:
            report.without_valid_images.append(exercise_id)
            continue
        try:
            with database.session() as session:
                stored = exists().where(ExerciseImage.exercise_id == exercise_id)
                if session.scalar(select(stored)):
                    report.already_done.append(exercise_id)
                    continue
                for image in images:
                    image.exercise_id = exercise_id
                session.add_all(images)
                session.flush()
        except IntegrityError:
            # Another run stored images for this exercise first.
            report.already_done.append(exercise_id)
            continue
        report.updated.append(exercise_id)
    return report
