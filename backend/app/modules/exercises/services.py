from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.modules.auth.models import User, UserRole, utc_now
from app.modules.exercises.models import Exercise, ExerciseApprovalEvent
from app.modules.exercises.schemas import ExercisePage, ExerciseResponse


class ExerciseService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, exercise_id: UUID) -> Exercise:
        exercise = self.session.get(Exercise, exercise_id)
        if (
            exercise is None
            or not exercise.is_active
            or exercise.approval_status != "approved"
            or exercise.approved_rule_version != exercise.rule_version
        ):
            raise ApiError(
                status_code=404,
                code="exercise_not_found",
                message="The exercise was not found.",
            )
        return exercise

    def list(self, page: int, page_size: int) -> ExercisePage:
        query = select(Exercise).where(
            Exercise.is_active.is_(True),
            Exercise.approval_status == "approved",
            Exercise.approved_rule_version == Exercise.rule_version,
        )
        total = (
            self.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        )
        items = self.session.scalars(
            query.order_by(Exercise.created_at.desc(), Exercise.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return ExercisePage(
            items=[ExerciseResponse.model_validate(x) for x in items],
            page=page,
            page_size=page_size,
            total=total,
            pages=(total + page_size - 1) // page_size,
        )


class ExerciseGovernanceService:
    """Internal support for an institutionally authorized approval workflow.

    No public API calls this service. Recording evidence here is an audit action;
    the organization remains responsible for verifying the underlying clinical
    approval before invoking it.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def approve(
        self, actor: User, exercise_id: UUID, document_reference: str
    ) -> Exercise:
        exercise = self._exercise_and_actor(actor, exercise_id)
        reference = self._reference(document_reference)
        if exercise.supported_parameters:
            raise ApiError(
                status_code=409,
                code="parameter_contract_pending",
                message="This exercise requires an approved parameter validator.",
            )
        decided_at = utc_now()
        exercise.approval_status = "approved"
        exercise.approved_rule_version = exercise.rule_version
        exercise.approved_by_id = actor.id
        exercise.approved_at = decided_at
        exercise.approval_document_reference = reference
        exercise.updated_at = decided_at
        self._event(exercise, actor, "approved", reference, decided_at)
        self.session.flush()
        return exercise

    def revoke(
        self, actor: User, exercise_id: UUID, document_reference: str
    ) -> Exercise:
        exercise = self._exercise_and_actor(actor, exercise_id)
        reference = self._reference(document_reference)
        decided_at = utc_now()
        exercise.approval_status = "revoked"
        exercise.updated_at = decided_at
        self._event(exercise, actor, "revoked", reference, decided_at)
        self.session.flush()
        return exercise

    def _exercise_and_actor(self, actor: User, exercise_id: UUID) -> Exercise:
        if (
            actor.role is not UserRole.PHYSIOTHERAPIST
            or not actor.is_active
            or actor.must_change_password
        ):
            raise ApiError(
                status_code=403,
                code="clinical_approval_forbidden",
                message=(
                    "Clinical approval evidence requires an active physiotherapist."
                ),
            )
        exercise = self.session.get(Exercise, exercise_id)
        if exercise is None:
            raise ApiError(
                status_code=404,
                code="exercise_not_found",
                message="The exercise was not found.",
            )
        return exercise

    @staticmethod
    def _reference(value: str) -> str:
        reference = value.strip()
        if not reference or len(reference) > 500:
            raise ApiError(
                status_code=422,
                code="approval_document_reference_invalid",
                message="A valid approval document reference is required.",
            )
        return reference

    def _event(
        self,
        exercise: Exercise,
        actor: User,
        decision: str,
        reference: str,
        decided_at: datetime,
    ) -> None:
        self.session.add(
            ExerciseApprovalEvent(
                exercise_id=exercise.id,
                rule_version=exercise.rule_version,
                decision=decision,
                decided_by_id=actor.id,
                decided_at=decided_at,
                document_reference=reference,
            )
        )
