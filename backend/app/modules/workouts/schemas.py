from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.modules.exercises.schemas import Side

Positive = Annotated[int, Field(strict=True, gt=0)]
Nonnegative = Annotated[int, Field(strict=True, ge=0)]


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WorkoutItemInput(StrictRequest):
    position: Positive
    exercise_id: UUID
    side: Side
    sets: Positive
    repetitions: Positive
    rest_duration_ms: Nonnegative
    professional_guidance: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)


class WorkoutCreate(StrictRequest):
    instructions: str | None = None
    items: list[WorkoutItemInput] = Field(min_length=1)

    @model_validator(mode="after")
    def ordered(self) -> "WorkoutCreate":
        if [x.position for x in self.items] != list(range(1, len(self.items) + 1)):
            raise ValueError(
                "Items must be ordered with contiguous positions starting at 1"
            )
        return self


class WorkoutUpdate(StrictRequest):
    instructions: str | None = None
    items: list[WorkoutItemInput] | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def patch(self) -> "WorkoutUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        if "items" in self.model_fields_set:
            if self.items is None:
                raise ValueError("items cannot be null")
            WorkoutCreate(items=self.items)
        return self


class WorkoutItemResponse(WorkoutItemInput):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    rule_version: str
    exercise_snapshot: dict[str, Any]


class WorkoutResponse(BaseModel):
    id: UUID
    patient_id: UUID
    created_by: UUID
    status: Literal["draft", "published", "archived"]
    current_revision_id: UUID
    revision_number: int
    instructions: str | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    items: list[WorkoutItemResponse]

    @field_validator("created_at", "updated_at", "published_at")
    @classmethod
    def utc_dates(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return (
            value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
        )


class WorkoutPage(BaseModel):
    items: list[WorkoutResponse]
    page: int
    page_size: int
    total: int
    pages: int
