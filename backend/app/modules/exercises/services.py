from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.modules.auth.models import User, UserRole, utc_now
from app.modules.exercises.models import (
    Exercise,
    ExerciseApprovalEvent,
    ExerciseImage,
)
from app.modules.exercises.schemas import (
    ExerciseLocalizationUpdate,
    ExercisePage,
    ExerciseResponse,
    format_steps,
)


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


class ExerciseImageService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, exercise_id: UUID, position: int) -> tuple[bytes, str, str]:
        """(bytes, content type, sha256) of one stored image.

        Served for any catalog exercise, including withdrawn ones: published
        snapshots keep their image URLs and must keep working (DEC-010). The
        material is the public CC BY-NC reference, not patient data.
        """
        row = self.session.execute(
            select(ExerciseImage.data, ExerciseImage.content_type, ExerciseImage.sha256)
            .where(
                ExerciseImage.exercise_id == exercise_id,
                ExerciseImage.position == position,
            )
            .limit(1)
        ).first()
        if row is None:
            raise ApiError(
                status_code=404,
                code="exercise_image_not_found",
                message="The exercise image was not found.",
            )
        return row[0], row[1], row[2]


class ExerciseLocalizationService:
    """pt-BR name and steps (DEC-011): any active physiotherapist, authorship kept.

    The original text, `rule_version` and the approval are never touched.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def update(
        self, actor: User, exercise_id: UUID, payload: ExerciseLocalizationUpdate
    ) -> ExerciseResponse:
        exercise = ExerciseService(self.session).get(exercise_id)
        exercise.name_pt_br = payload.name
        exercise.instructions_pt_br = format_steps(payload.instructions)
        exercise.translated_by_id = actor.id
        exercise.translated_at = utc_now()
        self.session.flush()
        self.session.expire(exercise, ["translator", "translator_profile"])
        return ExerciseResponse.model_validate(exercise)


class ExerciseGovernanceService:
    """Records approval evidence and appends one audit event per decision.

    The only public caller is `CatalogImportService`
    (`POST /exercise-library/{external_id}/catalog`): under DEC-006 a
    physiotherapist adds reference material to the catalog for academic use, and
    the approval is recorded in their name. That approval means "chosen by the
    physiotherapist for academic use", not clinical validation; review it before
    any clinical or commercial use. Every other approval or revocation remains an
    internal action whose underlying evidence the organization must verify.
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
