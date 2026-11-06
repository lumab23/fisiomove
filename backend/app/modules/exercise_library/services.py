import logging
from typing import NoReturn

from app.core.errors import ApiError
from app.modules.exercise_library.providers import (
    ExerciseLibraryProvider,
    ExternalLibraryUnavailableError,
    LibraryExerciseSummary,
)
from app.modules.exercise_library.schemas import (
    LibraryAttribution,
    LibraryExerciseDetailResponse,
    LibraryExercisePage,
    LibraryExerciseSummaryResponse,
    LibraryInstructionStepResponse,
)

logger = logging.getLogger("fisiomove.exercise_library")


def _normalize(value: str) -> str:
    """Case/spacing-insensitive form; the provider mixes `full_body`/`full body`."""
    return " ".join(value.casefold().replace("_", " ").split())


UNAVAILABLE_MESSAGE = "The external exercise library is unavailable."


def raise_unavailable(message: str = UNAVAILABLE_MESSAGE) -> NoReturn:
    raise ApiError(
        status_code=503,
        code="external_library_unavailable",
        message=message,
        headers={"Retry-After": "30"},
    )


class ExerciseLibraryService:
    """Read-only search over reference material; never touches `exercises`."""

    def __init__(self, provider: ExerciseLibraryProvider) -> None:
        self._provider = provider

    def search(
        self,
        *,
        query: str | None,
        body_part: str | None,
        page: int,
        page_size: int,
    ) -> LibraryExercisePage:
        try:
            exercises = self._provider.list_exercises()
        except ExternalLibraryUnavailableError as exc:
            logger.warning("external_library_unavailable", extra={"reason": str(exc)})
            raise_unavailable()
        needle = _normalize(query) if query else ""
        wanted_part = _normalize(body_part) if body_part else ""
        matches = sorted(
            (
                item
                for item in exercises
                if needle in _normalize(item.name)
                and (
                    not wanted_part
                    or any(_normalize(part) == wanted_part for part in item.body_parts)
                )
            ),
            key=lambda item: (item.name.casefold(), item.external_id),
        )
        total = len(matches)
        start = (page - 1) * page_size
        return LibraryExercisePage(
            items=[self._summary(item) for item in matches[start : start + page_size]],
            page=page,
            page_size=page_size,
            total=total,
            pages=(total + page_size - 1) // page_size,
            attribution=LibraryAttribution(source_url=self._provider.list_source_url),
        )

    def get(self, external_id: str) -> LibraryExerciseDetailResponse:
        try:
            detail = self._provider.get_exercise(external_id)
        except ExternalLibraryUnavailableError as exc:
            logger.warning("external_library_unavailable", extra={"reason": str(exc)})
            raise_unavailable()
        if detail is None:
            raise ApiError(
                status_code=404,
                code="library_exercise_not_found",
                message="The reference exercise was not found.",
            )
        return LibraryExerciseDetailResponse(
            external_id=detail.external_id,
            name=detail.name,
            categories=list(detail.categories),
            body_parts=list(detail.body_parts),
            equipment=list(detail.equipment),
            instructions=[
                LibraryInstructionStepResponse(
                    step_number=step.step_number, description=step.description
                )
                for step in detail.instructions
            ],
            image_urls=list(detail.image_urls),
            review_status=detail.review_status,
            created_by=detail.created_by,
            attribution=LibraryAttribution(source_url=detail.source_url),
        )

    @staticmethod
    def _summary(item: LibraryExerciseSummary) -> LibraryExerciseSummaryResponse:
        return LibraryExerciseSummaryResponse(
            external_id=item.external_id,
            name=item.name,
            categories=list(item.categories),
            body_parts=list(item.body_parts),
            equipment=list(item.equipment),
            image_url=item.image_url,
            review_status=item.review_status,
        )
