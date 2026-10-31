import json
from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    field_validator,
    model_validator,
)

Positive = Annotated[int, Field(strict=True, gt=0)]
Nonnegative = Annotated[int, Field(strict=True, ge=0)]


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SessionItemResultCreate(StrictRequest):
    workout_item_id: UUID
    position: Positive
    completed_sets: Nonnegative
    completed_repetitions: Nonnegative
    active_duration_ms: Nonnegative
    interrupted: StrictBool


class SessionResultCreate(StrictRequest):
    client_session_id: UUID
    workout_id: UUID
    workout_revision_id: UUID
    status: Literal["completed", "interrupted"]
    started_at: datetime
    finished_at: datetime
    active_duration_ms: Nonnegative
    low_confidence_summary: dict[str, Any] | None = None
    feedback_summary: dict[str, Any] | None = None
    items: list[SessionItemResultCreate]

    @field_validator("low_confidence_summary", "feedback_summary")
    @classmethod
    def summaries_are_json_safe(
        cls, value: dict[str, Any] | None
    ) -> dict[str, Any] | None:
        try:
            json.dumps(value, allow_nan=False)
        except (ValueError, TypeError) as exc:
            raise ValueError("Summaries must contain finite JSON values") from exc
        return value

    @field_validator("started_at", "finished_at")
    @classmethod
    def dates_have_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Datetime values must include a timezone")
        return value.astimezone(UTC)

    @model_validator(mode="after")
    def valid_duration(self) -> "SessionResultCreate":
        if self.finished_at < self.started_at:
            raise ValueError("finished_at must not precede started_at")
        item_ids = [item.workout_item_id for item in self.items]
        if len(item_ids) != len(set(item_ids)):
            raise ValueError("A workout item can only appear once")
        positions = [item.position for item in self.items]
        if len(positions) != len(set(positions)):
            raise ValueError("Workout item positions must be unique")
        return self


class SessionItemResultResponse(SessionItemResultCreate):
    pass


class SessionResultFields(BaseModel):
    id: UUID
    client_session_id: UUID
    patient_id: UUID
    workout_id: UUID
    workout_revision_id: UUID
    status: Literal["completed", "interrupted"]
    started_at: datetime
    finished_at: datetime
    active_duration_ms: int
    completed_repetitions: int
    score: int

    @field_validator("started_at", "finished_at")
    @classmethod
    def utc_dates(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class SessionResultResponse(SessionResultFields):
    low_confidence_summary: dict[str, Any] | None
    feedback_summary: dict[str, Any] | None
    workout_snapshot: dict[str, Any]
    items: list[SessionItemResultResponse]
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def utc_created_at(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class SessionSummary(BaseModel):
    id: UUID
    patient_id: UUID
    workout_id: UUID
    workout_revision_id: UUID
    status: Literal["completed", "interrupted"]
    started_at: datetime
    finished_at: datetime
    active_duration_ms: int
    prescribed_repetitions: int
    performed_repetitions: int
    score: int

    @field_validator("started_at", "finished_at")
    @classmethod
    def utc_dates(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class SessionPage(BaseModel):
    items: list[SessionSummary]
    page: int
    page_size: int
    total: int
    pages: int
