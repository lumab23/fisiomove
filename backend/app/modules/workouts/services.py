from copy import deepcopy
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.modules.auth.models import User, UserRole, utc_now
from app.modules.patients.authorization import get_authorized_patient
from app.modules.patients.models import Patient
from app.modules.workouts.models import Workout, WorkoutItem, WorkoutRevision
from app.modules.workouts.prescriptions import prepare_items
from app.modules.workouts.schemas import (
    WorkoutCreate,
    WorkoutItemResponse,
    WorkoutPage,
    WorkoutResponse,
    WorkoutUpdate,
)


def fail(code: str, status: int = 404) -> None:
    raise ApiError(
        status_code=status,
        code=code,
        message="The workout is unavailable for this operation.",
    )


class WorkoutService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def authorize_patient(
        self, user: User, patient_id: UUID, *, write: bool = False
    ) -> Patient:
        if user.role == UserRole.PHYSIOTHERAPIST:
            return get_authorized_patient(self.session, user.id, patient_id)
        if not write and user.role == UserRole.PATIENT:
            patient = self.session.scalar(
                select(Patient).where(
                    Patient.id == patient_id,
                    Patient.user_id == user.id,
                    Patient.is_active.is_(True),
                )
            )
            if patient is not None:
                return patient
        fail("patient_not_found")

    def own_patient(self, user: User) -> Patient:
        patient = self.session.scalar(
            select(Patient).where(
                Patient.user_id == user.id, Patient.is_active.is_(True)
            )
        )
        if patient is None:
            fail("patient_not_found")
        return patient

    def load(self, user: User, workout_id: UUID, *, write: bool = False) -> Workout:
        query = select(Workout).where(Workout.id == workout_id)
        if write:
            query = query.with_for_update()
        workout = self.session.scalar(query)
        if workout is None:
            fail("workout_not_found")
        self.authorize_patient(user, workout.patient_id, write=write)
        if user.role == UserRole.PATIENT and workout.status != "published":
            fail("workout_not_found")
        return workout

    def items(self, revision_id: UUID) -> list[WorkoutItem]:
        return list(
            self.session.scalars(
                select(WorkoutItem)
                .where(WorkoutItem.revision_id == revision_id)
                .order_by(WorkoutItem.position)
            )
        )

    def response(self, workout: Workout) -> WorkoutResponse:
        revision = self.session.get(WorkoutRevision, workout.current_revision_id)
        return WorkoutResponse(
            id=workout.id,
            patient_id=workout.patient_id,
            created_by=workout.created_by,
            status=workout.status,
            current_revision_id=revision.id,
            revision_number=revision.revision_number,
            instructions=revision.instructions,
            published_at=revision.published_at,
            created_at=workout.created_at,
            updated_at=workout.updated_at,
            items=[
                WorkoutItemResponse.model_validate(x) for x in self.items(revision.id)
            ],
        )

    def revision(
        self,
        workout: Workout,
        instructions: str | None,
        items: list[WorkoutItem],
        *,
        published: bool = False,
    ) -> None:
        previous = (
            self.session.get(WorkoutRevision, workout.current_revision_id)
            if workout.current_revision_id
            else None
        )
        revision = WorkoutRevision(
            workout_id=workout.id,
            revision_number=(previous.revision_number + 1 if previous else 1),
            instructions=instructions,
            published_at=utc_now() if published else None,
        )
        self.session.add(revision)
        self.session.flush()
        for item in items:
            item.revision_id = revision.id
        self.session.add_all(items)
        workout.current_revision_id = revision.id
        workout.updated_at = utc_now()
        self.session.flush()

    def copy_items(self, revision_id: UUID) -> list[WorkoutItem]:
        fields = (
            "position",
            "exercise_id",
            "rule_version",
            "exercise_snapshot",
            "side",
            "sets",
            "repetitions",
            "rest_duration_ms",
            "professional_guidance",
            "parameters",
        )
        return [
            WorkoutItem(**{field: deepcopy(getattr(item, field)) for field in fields})
            for item in self.items(revision_id)
        ]

    def create(
        self, user: User, patient_id: UUID, payload: WorkoutCreate
    ) -> WorkoutResponse:
        self.authorize_patient(user, patient_id, write=True)
        items = prepare_items(self.session, payload.items)
        workout = Workout(patient_id=patient_id, created_by=user.id, status="draft")
        self.session.add(workout)
        self.session.flush()
        self.revision(workout, payload.instructions, items)
        return self.response(workout)

    def get(self, user: User, workout_id: UUID) -> WorkoutResponse:
        return self.response(self.load(user, workout_id))

    def list(
        self, user: User, patient_id: UUID, page: int, page_size: int
    ) -> WorkoutPage:
        self.authorize_patient(user, patient_id)
        query = select(Workout).where(Workout.patient_id == patient_id)
        if user.role == UserRole.PATIENT:
            query = query.where(Workout.status == "published")
        total = (
            self.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        )
        workouts = self.session.scalars(
            query.order_by(Workout.created_at.desc(), Workout.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return WorkoutPage(
            items=[self.response(x) for x in workouts],
            page=page,
            page_size=page_size,
            total=total,
            pages=(total + page_size - 1) // page_size,
        )

    def update(
        self, user: User, workout_id: UUID, payload: WorkoutUpdate
    ) -> WorkoutResponse:
        workout = self.load(user, workout_id, write=True)
        if workout.status == "archived":
            fail("workout_archived", 409)
        previous = self.session.get(WorkoutRevision, workout.current_revision_id)
        instructions = (
            payload.instructions
            if "instructions" in payload.model_fields_set
            else previous.instructions
        )
        items = (
            prepare_items(self.session, payload.items)
            if payload.items is not None
            else self.copy_items(previous.id)
        )
        self.revision(workout, instructions, items)
        workout.status = "draft"
        self.session.flush()
        return self.response(workout)

    def publish(self, user: User, workout_id: UUID) -> WorkoutResponse:
        workout = self.load(user, workout_id, write=True)
        if workout.status != "draft":
            fail("workout_not_draft", 409)
        previous = self.session.get(WorkoutRevision, workout.current_revision_id)
        self.revision(
            workout, previous.instructions, self.copy_items(previous.id), published=True
        )
        workout.status = "published"
        self.session.flush()
        return self.response(workout)

    def archive(self, user: User, workout_id: UUID) -> WorkoutResponse:
        workout = self.load(user, workout_id, write=True)
        workout.status = "archived"
        workout.updated_at = utc_now()
        self.session.flush()
        return self.response(workout)

    def published_snapshot(
        self, user: User, workout_id: UUID, revision_id: UUID
    ) -> dict:
        """B07 interface: authorized published snapshot, including archived history.

        Current catalog data is never consulted. B07 must enforce its own rules for
        accepting a new session against an archived/noncurrent prescription.
        """
        workout = self.session.get(Workout, workout_id)
        if workout is None:
            fail("workout_not_found")
        self.authorize_patient(user, workout.patient_id)
        revision = self.session.get(WorkoutRevision, revision_id)
        if (
            revision is None
            or revision.workout_id != workout.id
            or revision.published_at is None
        ):
            fail("revision_not_found")
        return dict(
            workout_id=str(workout.id),
            workout_revision_id=str(revision.id),
            revision_number=revision.revision_number,
            instructions=revision.instructions,
            published_at=revision.published_at.isoformat(),
            items=[
                WorkoutItemResponse.model_validate(x).model_dump(mode="json")
                for x in self.items(revision.id)
            ],
        )
