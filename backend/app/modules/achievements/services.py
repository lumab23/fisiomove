from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.modules.achievements.models import Achievement
from app.modules.achievements.schemas import AchievementResponse
from app.modules.auth.models import User
from app.modules.patients.authorization import get_authorized_patient
from app.modules.patients.models import Patient
from app.modules.sessions.models import SessionResult

SESSION_GOAL_REACHED = "session_goal_reached"


class AchievementService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def award_session_goal(self, result: SessionResult) -> Achievement | None:
        """Award only when every prescribed item was completed exactly."""
        if result.status != "completed":
            return None
        planned = {item["id"]: item for item in result.workout_snapshot["items"]}
        performed = {item["workout_item_id"]: item for item in result.items}
        if set(planned) != set(performed):
            return None
        for item_id, prescription in planned.items():
            performance = performed[item_id]
            if int(performance["completed_sets"]) != int(prescription["sets"]) or int(
                performance["completed_repetitions"]
            ) != int(prescription["sets"]) * int(prescription["repetitions"]):
                return None

        existing = self.session.scalar(
            select(Achievement).where(
                Achievement.patient_id == result.patient_id,
                Achievement.session_result_id == result.id,
                Achievement.code == SESSION_GOAL_REACHED,
            )
        )
        if existing is not None:
            return existing
        record = Achievement(
            patient_id=result.patient_id,
            session_result_id=result.id,
            code=SESSION_GOAL_REACHED,
        )
        try:
            with self.session.begin_nested():
                self.session.add(record)
                self.session.flush()
        except IntegrityError:
            existing = self.session.scalar(
                select(Achievement).where(
                    Achievement.patient_id == result.patient_id,
                    Achievement.session_result_id == result.id,
                    Achievement.code == SESSION_GOAL_REACHED,
                )
            )
            if existing is None:
                raise
            return existing
        return record

    def list_for_user(self, user: User) -> list[AchievementResponse]:
        patient = self.session.scalar(
            select(Patient).where(
                Patient.user_id == user.id, Patient.is_active.is_(True)
            )
        )
        if patient is None:
            raise ApiError(
                status_code=404,
                code="patient_not_found",
                message="The patient was not found.",
            )
        return self._list(patient.id)

    def list_for_patient(
        self, user: User, patient_id: UUID
    ) -> list[AchievementResponse]:
        get_authorized_patient(self.session, user.id, patient_id)
        return self._list(patient_id)

    def _list(self, patient_id: UUID) -> list[AchievementResponse]:
        records = self.session.scalars(
            select(Achievement)
            .where(Achievement.patient_id == patient_id)
            .order_by(Achievement.achieved_at.desc(), Achievement.id)
        )
        return [AchievementResponse.model_validate(value) for value in records]
