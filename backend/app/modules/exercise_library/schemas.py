from typing import Literal
from uuid import UUID

from pydantic import BaseModel

# Value stored in `exercises.source` for material added from this library.
OPENEXERCISEBASE_SOURCE = "openexercisebase"
SOURCE_NAME = (
    "OpenExerciseBase (Ludwig Boltzmann Institute for Digital Health and Prevention)"
)
LICENSE_NAME = "CC BY-NC 4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by-nc/4.0/"
CHANGES_NOTICE = (
    "Only selected descriptive fields are shown; text is kept in the original "
    "language without edits. Performance metrics and variations are omitted."
)
USAGE_NOTICE = (
    "External reference material. A physiotherapist may add it to the FisioMove "
    "catalog for academic use; prescription values are always set by the "
    "physiotherapist."
)


class LibraryAttribution(BaseModel):
    source: str = SOURCE_NAME
    license: str = LICENSE_NAME
    license_url: str = LICENSE_URL
    source_url: str
    changes: str = CHANGES_NOTICE


class LibraryExerciseSummaryResponse(BaseModel):
    external_id: str
    name: str
    categories: list[str]
    body_parts: list[str]
    equipment: list[str]
    image_url: str | None
    review_status: str | None


class LibraryExercisePage(BaseModel):
    items: list[LibraryExerciseSummaryResponse]
    page: int
    page_size: int
    total: int
    pages: int
    usage_notice: str = USAGE_NOTICE
    attribution: LibraryAttribution


class LibraryInstructionStepResponse(BaseModel):
    step_number: int
    description: str


class CatalogExerciseStatus(BaseModel):
    """The FisioMove catalog exercise created from this reference, if any."""

    exercise_id: UUID
    approval_status: Literal["pending", "approved", "revoked"]
    added_by_me: bool


class LibraryExerciseDetailResponse(BaseModel):
    external_id: str
    name: str
    categories: list[str]
    body_parts: list[str]
    equipment: list[str]
    instructions: list[LibraryInstructionStepResponse]
    instructions_language: str = "en"
    image_urls: list[str]
    review_status: str | None
    created_by: str | None
    usage_notice: str = USAGE_NOTICE
    attribution: LibraryAttribution
    catalog_exercise: CatalogExerciseStatus | None = None
