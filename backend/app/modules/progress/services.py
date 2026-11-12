from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.auth.models import User, utc_now
from app.modules.progress.schemas import ProgressSummary
from app.modules.sessions.services import SessionService


class ProgressService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def summary(
        self,
        user: User,
        patient_id: UUID,
        period_start: datetime,
        period_end: datetime,
    ) -> ProgressSummary:
        records = SessionService(self.session).records(
            user, patient_id, period_start, period_end
        )
        return ProgressSummary(
            patient_id=patient_id,
            period_start=period_start,
            period_end=period_end,
            completed_sessions=sum(record.status == "completed" for record in records),
            interrupted_sessions=sum(
                record.status == "interrupted" for record in records
            ),
            active_duration_ms=sum(record.active_duration_ms for record in records),
            prescribed_repetitions=sum(
                int(item["sets"]) * int(item["repetitions"])
                for record in records
                for item in record.workout_snapshot["items"]
            ),
            performed_repetitions=sum(
                int(item["completed_repetitions"])
                for record in records
                for item in record.items
            ),
            score=sum(record.score for record in records),
            generated_at=utc_now(),
        )
