from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.modules.auth.dependencies import require_role
from app.modules.auth.models import User, UserRole
from app.modules.sessions.schemas import SessionResultCreate, SessionResultResponse
from app.modules.sessions.services import SessionService

router = APIRouter(tags=["sessions"])
DatabaseSession = Annotated[Session, Depends(get_db_session, scope="function")]
PatientUser = Annotated[User, Depends(require_role(UserRole.PATIENT))]


@router.post("/me/sessions", response_model=SessionResultResponse, status_code=201)
def create_session(
    payload: SessionResultCreate, user: PatientUser, session: DatabaseSession
) -> SessionResultResponse:
    return SessionService(session).create(user, payload)
