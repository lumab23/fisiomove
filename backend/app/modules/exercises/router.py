from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, Response
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.auth.models import User, UserRole
from app.modules.exercises.models import IMAGE_CONTENT_TYPES, MAX_IMAGES_PER_EXERCISE
from app.modules.exercises.schemas import (
    ExerciseLocalizationUpdate,
    ExercisePage,
    ExerciseResponse,
)
from app.modules.exercises.services import (
    ExerciseImageService,
    ExerciseLocalizationService,
    ExerciseService,
)

router = APIRouter(
    prefix="/exercises", tags=["exercises"], dependencies=[Depends(get_current_user)]
)
DatabaseSession = Annotated[Session, Depends(get_db_session, scope="function")]
Professional = Annotated[User, Depends(require_role(UserRole.PHYSIOTHERAPIST))]
# Stored images never change for a given (exercise, position).
IMAGE_CACHE_CONTROL = "private, max-age=86400"


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


@router.get(
    "/{exercise_id}/images/{position}",
    response_class=Response,
    responses={
        200: {
            "content": {content_type: {} for content_type in IMAGE_CONTENT_TYPES},
            "description": "Image bytes copied from the reference library.",
        }
    },
)
def get_exercise_image(
    exercise_id: UUID,
    position: Annotated[int, Path(ge=1, le=MAX_IMAGES_PER_EXERCISE)],
    session: DatabaseSession,
) -> Response:
    data, content_type, sha256 = ExerciseImageService(session).get(
        exercise_id, position
    )
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": IMAGE_CACHE_CONTROL, "ETag": f'"{sha256}"'},
    )


@router.put("/{exercise_id}/localization", response_model=ExerciseResponse)
def update_localization(
    exercise_id: UUID,
    payload: ExerciseLocalizationUpdate,
    user: Professional,
    session: DatabaseSession,
) -> ExerciseResponse:
    return ExerciseLocalizationService(session).update(user, exercise_id, payload)
