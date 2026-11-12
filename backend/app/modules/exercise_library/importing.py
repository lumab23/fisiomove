"""Add a reference exercise to the FisioMove catalog (DEC-006, academic use).

The server fetches the reference itself and never trusts descriptive data from
the client. The name and instructions are copied unedited, together with up to
six images (DEC-010); the physiotherapist chooses the allowed sides and may add
a pt-BR name and steps, kept apart from the original (DEC-011). No prescription
value (sets, repetitions, rest, parameters) is derived from the source.

When the exercise already exists, nothing is overwritten: sides and any pt-BR
text in the request are ignored (use `PUT /exercises/{id}/localization`).
"""

import logging
from uuid import NAMESPACE_URL, uuid5

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.modules.auth.models import User, utc_now
from app.modules.exercise_library.images import download_images
from app.modules.exercise_library.providers import (
    ExerciseLibraryProvider,
    ExternalLibraryUnavailableError,
    LibraryExerciseDetail,
)
from app.modules.exercise_library.schemas import (
    LICENSE_NAME,
    OPENEXERCISEBASE_SOURCE,
    CatalogExerciseStatus,
)
from app.modules.exercise_library.services import raise_unavailable
from app.modules.exercises.models import Exercise
from app.modules.exercises.schemas import (
    ExerciseResponse,
    LocalizedName,
    LocalizedSteps,
    Side,
    format_steps,
)
from app.modules.exercises.services import ExerciseGovernanceService

logger = logging.getLogger("fisiomove.exercise_library")

# No camera rule exists for imported material; `MovementEngine` stays off.
LIBRARY_RULE_VERSION = "library-reference-no-camera-rule:v1"
# Mirror the `exercises` column sizes (`name` String(200), `source_url` String(500)).
NAME_MAX_LENGTH = 200
SOURCE_URL_MAX_LENGTH = 500


class CatalogImportRequest(BaseModel):
    """Sides and the optional pt-BR text come from the client.

    The original descriptive data is always fetched here. The pt-BR name and
    steps are written by the physiotherapist (DEC-011); both or neither.
    """

    model_config = ConfigDict(extra="forbid")

    allowed_sides: list[Side] = Field(min_length=1, max_length=3)
    name_pt_br: LocalizedName | None = None
    instructions_pt_br: LocalizedSteps | None = None

    @field_validator("allowed_sides")
    @classmethod
    def unique_sides(cls, value: list[Side]) -> list[Side]:
        if len(set(value)) != len(value):
            raise ValueError("allowed_sides must not repeat a side")
        return value

    @model_validator(mode="after")
    def both_or_neither_translation(self) -> "CatalogImportRequest":
        if (self.name_pt_br is None) != (self.instructions_pt_br is None):
            raise ValueError("name_pt_br and instructions_pt_br must be sent together")
        return self


def catalog_code(external_id: str) -> str:
    """Stable, collision-resistant catalog code for one reference exercise."""
    return "oeb-" + uuid5(NAMESPACE_URL, f"openexercisebase:{external_id}").hex


def approval_reference(external_id: str) -> str:
    return (
        f"fisiomove:library-import:openexercisebase:{external_id}; "
        "DEC-006 (uso acadêmico)"
    )


def _instructions(detail: LibraryExerciseDetail) -> str:
    return "\n".join(
        f"{step.step_number}. {step.description}" for step in detail.instructions
    )


class CatalogImportService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def find(self, external_id: str) -> Exercise | None:
        return self.session.scalar(
            select(Exercise).where(
                Exercise.source == OPENEXERCISEBASE_SOURCE,
                Exercise.source_external_id == external_id,
            )
        )

    def status(self, user: User, external_id: str) -> CatalogExerciseStatus | None:
        exercise = self.find(external_id)
        if exercise is None:
            return None
        return CatalogExerciseStatus(
            exercise_id=exercise.id,
            approval_status=exercise.approval_status,
            added_by_me=exercise.approved_by_id == user.id,
        )

    def add(
        self,
        user: User,
        provider: ExerciseLibraryProvider,
        external_id: str,
        payload: CatalogImportRequest,
    ) -> tuple[ExerciseResponse, bool]:
        """Return the catalog exercise and whether this call created it."""
        existing = self.find(external_id)
        if existing is not None:
            return self._existing(existing), False

        try:
            detail = provider.get_exercise(external_id)
        except ExternalLibraryUnavailableError as exc:
            logger.warning("external_library_unavailable", extra={"reason": str(exc)})
            raise_unavailable()
        if detail is None:
            raise ApiError(
                status_code=404,
                code="library_exercise_not_found",
                message="The reference exercise was not found.",
            )
        if not detail.instructions:
            raise ApiError(
                status_code=422,
                code="library_exercise_without_instructions",
                message="The reference exercise has no instructions to copy.",
            )
        # Text is copied unedited, so values beyond the column limits are refused
        # before any write instead of failing (or truncating) in the database.
        if len(detail.name) > NAME_MAX_LENGTH or len(detail.source_url) > (
            SOURCE_URL_MAX_LENGTH
        ):
            raise ApiError(
                status_code=422,
                code="library_exercise_too_long",
                message="The reference exercise does not fit the catalog limits.",
            )

        # Downloaded before any write, so no row lock is held during network I/O;
        # the rows are stored in the same transaction as the exercise.
        images = download_images(provider, detail)
        translation: dict[str, object] = {}
        if payload.name_pt_br is not None and payload.instructions_pt_br is not None:
            translation = {
                "name_pt_br": payload.name_pt_br,
                "instructions_pt_br": format_steps(payload.instructions_pt_br),
                "translated_by_id": user.id,
                "translated_at": utc_now(),
            }
        exercise = Exercise(
            **translation,
            images=images,
            code=catalog_code(external_id),
            name=detail.name,
            instructions=_instructions(detail),
            allowed_sides=[side.value for side in payload.allowed_sides],
            rule_version=LIBRARY_RULE_VERSION,
            supported_parameters={},
            source=OPENEXERCISEBASE_SOURCE,
            source_external_id=external_id,
            source_url=detail.source_url,
            source_license=LICENSE_NAME,
        )
        try:
            with self.session.begin_nested():
                self.session.add(exercise)
                self.session.flush()
                ExerciseGovernanceService(self.session).approve(
                    user, exercise.id, approval_reference(external_id)
                )
        except IntegrityError:
            # A concurrent request added the same reference first.
            existing = self.find(external_id)
            if existing is None:
                raise
            return self._existing(existing), False
        return ExerciseResponse.model_validate(exercise), True

    @staticmethod
    def _existing(exercise: Exercise) -> ExerciseResponse:
        """Never overwrite: the first physiotherapist's choice of sides stays."""
        if exercise.approval_status != "approved" or not exercise.is_active:
            raise ApiError(
                status_code=409,
                code="catalog_exercise_revoked",
                message="This reference exercise was withdrawn from the catalog.",
            )
        return ExerciseResponse.model_validate(exercise)
