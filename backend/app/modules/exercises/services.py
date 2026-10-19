from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.modules.exercises.models import Exercise
from app.modules.exercises.schemas import ExercisePage, ExerciseResponse


class ExerciseService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, exercise_id: UUID) -> Exercise:
        exercise = self.session.get(Exercise, exercise_id)
        if exercise is None or not exercise.is_active:
            raise ApiError(
                status_code=404,
                code="exercise_not_found",
                message="The exercise was not found.",
            )
        return exercise

    def list(self, page: int, page_size: int) -> ExercisePage:
        query = select(Exercise).where(Exercise.is_active.is_(True))
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
