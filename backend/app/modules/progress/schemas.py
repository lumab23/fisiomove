from datetime import UTC, datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class ProgressSummary(BaseModel):
    patient_id: UUID
    period_start: datetime
    period_end: datetime
    completed_sessions: int
    interrupted_sessions: int
    active_duration_ms: int
    prescribed_repetitions: int
    performed_repetitions: int
    generated_at: datetime

    @field_validator("period_start", "period_end", "generated_at")
    @classmethod
    def utc_dates(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
