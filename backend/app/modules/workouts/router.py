from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.auth.models import User, UserRole
from app.modules.workouts.schemas import (
    WorkoutCreate,
    WorkoutPage,
    WorkoutResponse,
    WorkoutUpdate,
)
from app.modules.workouts.services import WorkoutService

router = APIRouter(tags=["workouts"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
Professional = Annotated[User, Depends(require_role(UserRole.PHYSIOTHERAPIST))]
PatientUser = Annotated[User, Depends(require_role(UserRole.PATIENT))]
CurrentUser = Annotated[User, Depends(get_current_user)]
Page = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]


@router.post(
    "/patients/{patient_id}/workouts", response_model=WorkoutResponse, status_code=201
)
def create_workout(
    patient_id: UUID,
    payload: WorkoutCreate,
    user: Professional,
    session: DatabaseSession,
) -> WorkoutResponse:
    return WorkoutService(session).create(user, patient_id, payload)


@router.get("/patients/{patient_id}/workouts", response_model=WorkoutPage)
def list_workouts(
    patient_id: UUID,
    user: Professional,
    session: DatabaseSession,
    page: Page = 1,
    page_size: PageSize = 20,
) -> WorkoutPage:
    return WorkoutService(session).list(user, patient_id, page, page_size)


@router.get("/me/workouts", response_model=WorkoutPage)
def my_workouts(
    user: PatientUser,
    session: DatabaseSession,
    page: Page = 1,
    page_size: PageSize = 20,
) -> WorkoutPage:
    service = WorkoutService(session)
    return service.list(user, service.own_patient(user).id, page, page_size)


@router.get("/workouts/{workout_id}", response_model=WorkoutResponse)
def get_workout(
    workout_id: UUID, user: CurrentUser, session: DatabaseSession
) -> WorkoutResponse:
    return WorkoutService(session).get(user, workout_id)


@router.patch("/workouts/{workout_id}", response_model=WorkoutResponse)
def update_workout(
    workout_id: UUID,
    payload: WorkoutUpdate,
    user: Professional,
    session: DatabaseSession,
) -> WorkoutResponse:
    return WorkoutService(session).update(user, workout_id, payload)


@router.post("/workouts/{workout_id}/publish", response_model=WorkoutResponse)
def publish_workout(
    workout_id: UUID, user: Professional, session: DatabaseSession
) -> WorkoutResponse:
    return WorkoutService(session).publish(user, workout_id)


@router.post("/workouts/{workout_id}/archive", response_model=WorkoutResponse)
def archive_workout(
    workout_id: UUID, user: Professional, session: DatabaseSession
) -> WorkoutResponse:
    return WorkoutService(session).archive(user, workout_id)
