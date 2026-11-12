from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from app.modules.exercise_library.schemas import (
    LICENSE_URL,
    OPENEXERCISEBASE_SOURCE,
    SOURCE_NAME,
)

# Server-relative path of a stored image; assumes the default `API_PREFIX`.
IMAGE_PATH = "/api/v1/exercises/{exercise_id}/images/{position}"
PT_BR = "pt-BR"
LOCALIZED_NAME_MAX_LENGTH = 200  # `exercises.name_pt_br` String(200)
LOCALIZED_STEP_MAX_LENGTH = 2000
LOCALIZED_MAX_STEPS = 50

LocalizedName = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, min_length=1, max_length=LOCALIZED_NAME_MAX_LENGTH
    ),
]
# One line per step: steps are stored as "n. text" joined by newlines.
LocalizedStep = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=1,
        max_length=LOCALIZED_STEP_MAX_LENGTH,
        pattern=r"^[^\r\n]+$",
    ),
]
LocalizedSteps = Annotated[
    list[LocalizedStep], Field(min_length=1, max_length=LOCALIZED_MAX_STEPS)
]


class Side(StrEnum):
    LEFT = "left"
    RIGHT = "right"
    BILATERAL = "bilateral"


def format_steps(steps: list[str]) -> str:
    """Store steps in the same "n. text" format as the original instructions."""
    return "\n".join(f"{number}. {step}" for number, step in enumerate(steps, 1))


class ExerciseLocalizationUpdate(BaseModel):
    """pt-BR name and steps written or reviewed by a physiotherapist (DEC-011)."""

    model_config = ConfigDict(extra="forbid")

    name: LocalizedName
    instructions: LocalizedSteps


# Display data for each provenance key stored in `exercises.source`.
_KNOWN_SOURCES: dict[str, tuple[str, str]] = {
    OPENEXERCISEBASE_SOURCE: (SOURCE_NAME, LICENSE_URL),
}


class ExerciseSourceResponse(BaseModel):
    """Attribution for an exercise added from an external reference library."""

    source: str
    external_id: str
    source_url: str
    license: str
    license_url: str | None
    attribution: str


class ExerciseImageResponse(BaseModel):
    position: int
    url: str


class ExerciseLocalizationResponse(BaseModel):
    language: Literal["pt-BR"] = PT_BR
    name: str
    instructions: str
    translated_by_name: str
    translated_at: datetime


def _utc(value: datetime) -> datetime:
    # SQLite returns naive datetimes; values are always written in UTC.
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def exercise_source(
    source: str | None,
    external_id: str | None,
    source_url: str | None,
    license_name: str | None,
    localization: ExerciseLocalizationResponse | None = None,
) -> ExerciseSourceResponse | None:
    if (
        source is None
        or external_id is None
        or source_url is None
        or license_name is None
    ):
        return None
    name, license_url = _KNOWN_SOURCES.get(source, (source, None))
    if localization is None:
        attribution = (
            f"Name and instructions from {name}, licensed under {license_name}. "
            "Text is kept in the original language without edits."
        )
    else:
        # CC BY-NC requires indicating changes: the translation is one.
        attribution = (
            f"Adapted from {name}, licensed under {license_name}. Name and "
            "instructions translated into Portuguese by "
            f"{localization.translated_by_name} on "
            f"{localization.translated_at.date().isoformat()}; the original "
            "English text is preserved."
        )
    return ExerciseSourceResponse(
        source=name,
        external_id=external_id,
        source_url=source_url,
        license=license_name,
        license_url=license_url,
        attribution=attribution,
    )


TRANSLATOR_FALLBACK_NAME = "fisioterapeuta do FisioMove"


def exercise_localization(value: Any) -> ExerciseLocalizationResponse | None:
    """Build the pt-BR block from an `Exercise` row (all columns or none)."""
    name = getattr(value, "name_pt_br", None)
    instructions = getattr(value, "instructions_pt_br", None)
    translated_at = getattr(value, "translated_at", None)
    if name is None or instructions is None or translated_at is None:
        return None
    # Patients see this text in workout snapshots, so the account email is never
    # used (DEC-005); without a profile name, a neutral role label is shown.
    profile = getattr(value, "translator_profile", None)
    if profile is not None and profile.full_name:
        translated_by_name = profile.full_name
    else:
        translated_by_name = TRANSLATOR_FALLBACK_NAME
    return ExerciseLocalizationResponse(
        name=name,
        instructions=instructions,
        translated_by_name=translated_by_name,
        translated_at=_utc(translated_at),
    )


class ExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str
    instructions: str
    allowed_sides: list[Side]
    rule_version: str
    supported_parameters: dict[str, Any]
    is_active: bool
    approval_status: Literal["pending", "approved", "revoked"]
    approved_rule_version: str | None
    source: ExerciseSourceResponse | None = None
    images: list[ExerciseImageResponse] = []
    localization: ExerciseLocalizationResponse | None = None

    @model_validator(mode="before")
    @classmethod
    def _attribution_from_model(cls, value: Any) -> Any:
        """ORM rows store flat columns; expose attribution, images and pt-BR."""
        if isinstance(value, dict):
            return value
        derived = {"source", "images", "localization"}
        fields = {
            name: getattr(value, name)
            for name in cls.model_fields
            if name not in derived
        }
        localization = exercise_localization(value)
        fields["localization"] = localization
        fields["source"] = exercise_source(
            getattr(value, "source", None),
            getattr(value, "source_external_id", None),
            getattr(value, "source_url", None),
            getattr(value, "source_license", None),
            localization,
        )
        fields["images"] = [
            ExerciseImageResponse(
                position=image.position,
                url=IMAGE_PATH.format(exercise_id=value.id, position=image.position),
            )
            for image in getattr(value, "images", None) or []
        ]
        return fields


class ExercisePage(BaseModel):
    items: list[ExerciseResponse]
    page: int
    page_size: int
    total: int
    pages: int
