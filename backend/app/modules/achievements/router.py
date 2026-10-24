from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.modules.achievements.schemas import AchievementResponse
from app.modules.achievements.services import AchievementService
from app.modules.auth.dependencies import require_role
from app.modules.auth.models import User, UserRole

router = APIRouter(tags=["achievements"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
PatientUser = Annotated[User, Depends(require_role(UserRole.PATIENT))]
Professional = Annotated[User, Depends(require_role(UserRole.PHYSIOTHERAPIST))]


@router.get("/me/achievements", response_model=list[AchievementResponse])
def my_achievements(
    user: PatientUser, session: DatabaseSession
) -> list[AchievementResponse]:
    return AchievementService(session).list_for_user(user)


@router.get(
    "/patients/{patient_id}/achievements", response_model=list[AchievementResponse]
)
def patient_achievements(
    patient_id: UUID, user: Professional, session: DatabaseSession
) -> list[AchievementResponse]:
    return AchievementService(session).list_for_patient(user, patient_id)
