from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    StringConstraints,
    field_validator,
    model_validator,
)

Content = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class Visibility(StrEnum):
    PATIENT_VISIBLE = "patient_visible"
    PROFESSIONAL_ONLY = "professional_only"


class NoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: Content
    visibility: Visibility


class NoteUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: Content | None = None
    visibility: Visibility | None = None

    @model_validator(mode="after")
    def patch(self) -> "NoteUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Note fields cannot be null")
        return self


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    patient_id: UUID
    author_id: UUID
    content: str
    visibility: Visibility
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def utc_dates(cls, value: datetime) -> datetime:
        return (
            value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
        )


class NotePage(BaseModel):
    items: list[NoteResponse]
    page: int
    page_size: int
    total: int
    pages: int
