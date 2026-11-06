from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.modules.auth.dependencies import require_role
from app.modules.auth.models import User, UserRole
from app.modules.physiotherapists.schemas import (
    LinkedPhysiotherapistResponse,
    PhysiotherapistProfileResponse,
    PhysiotherapistProfileUpdate,
)
from app.modules.physiotherapists.services import PhysiotherapistProfileService

router = APIRouter(tags=["physiotherapists"])
Physiotherapist = Annotated[User, Depends(require_role(UserRole.PHYSIOTHERAPIST))]
PatientUser = Annotated[User, Depends(require_role(UserRole.PATIENT))]
DatabaseSession = Annotated[Session, Depends(get_db_session, scope="function")]


@router.get(
    "/me/physiotherapist-profile", response_model=PhysiotherapistProfileResponse
)
def get_my_physiotherapist_profile(
    professional: Physiotherapist, session: DatabaseSession
) -> PhysiotherapistProfileResponse:
    return PhysiotherapistProfileService(session).get_own(professional)


@router.put(
    "/me/physiotherapist-profile", response_model=PhysiotherapistProfileResponse
)
def set_my_physiotherapist_profile(
    payload: PhysiotherapistProfileUpdate,
    professional: Physiotherapist,
    session: DatabaseSession,
) -> PhysiotherapistProfileResponse:
    return PhysiotherapistProfileService(session).set_own(professional, payload)


@router.get("/me/physiotherapist", response_model=LinkedPhysiotherapistResponse)
def get_my_physiotherapist(
    user: PatientUser, session: DatabaseSession
) -> LinkedPhysiotherapistResponse:
    return PhysiotherapistProfileService(session).get_for_patient(user)
