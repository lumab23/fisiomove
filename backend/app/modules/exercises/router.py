from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.modules.auth.dependencies import get_current_user
from app.modules.exercises.schemas import ExercisePage, ExerciseResponse
from app.modules.exercises.services import ExerciseService

router = APIRouter(
    prefix="/exercises", tags=["exercises"], dependencies=[Depends(get_current_user)]
)
DatabaseSession = Annotated[Session, Depends(get_db_session)]


@router.get("", response_model=ExercisePage)
def list_exercises(
    session: DatabaseSession,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ExercisePage:
    return ExerciseService(session).list(page, page_size)


@router.get("/{exercise_id}", response_model=ExerciseResponse)
def get_exercise(exercise_id: UUID, session: DatabaseSession) -> ExerciseResponse:
    return ExerciseResponse.model_validate(ExerciseService(session).get(exercise_id))
