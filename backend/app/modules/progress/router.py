from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.modules.auth.dependencies import require_role
from app.modules.auth.models import User, UserRole
from app.modules.progress.schemas import ProgressSummary
from app.modules.progress.services import ProgressService
from app.modules.sessions.schemas import SessionPage, SessionResultResponse
from app.modules.sessions.services import SessionService

router = APIRouter(tags=["sessions", "progress"])
DatabaseSession = Annotated[Session, Depends(get_db_session, scope="function")]
PatientUser = Annotated[User, Depends(require_role(UserRole.PATIENT))]
Professional = Annotated[User, Depends(require_role(UserRole.PHYSIOTHERAPIST))]
Page = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]


@router.get("/me/sessions", response_model=SessionPage)
def list_my_sessions(
    user: PatientUser,
    session: DatabaseSession,
    page: Page = 1,
    page_size: PageSize = 20,
    period_start: datetime | None = None,
    period_end: datetime | None = None,
) -> SessionPage:
    service = SessionService(session)
    patient = service.own_patient(user)
    return service.list(user, patient.id, page, page_size, period_start, period_end)


@router.get("/me/sessions/{session_id}", response_model=SessionResultResponse)
def get_my_session(
    session_id: UUID, user: PatientUser, session: DatabaseSession
) -> SessionResultResponse:
    return SessionService(session).get(user, session_id)


@router.get("/patients/{patient_id}/sessions", response_model=SessionPage)
def list_patient_sessions(
    patient_id: UUID,
    user: Professional,
    session: DatabaseSession,
    page: Page = 1,
    page_size: PageSize = 20,
    period_start: datetime | None = None,
    period_end: datetime | None = None,
) -> SessionPage:
    return SessionService(session).list(
        user, patient_id, page, page_size, period_start, period_end
    )


@router.get(
    "/patients/{patient_id}/sessions/{session_id}",
    response_model=SessionResultResponse,
)
def get_patient_session(
    patient_id: UUID,
    session_id: UUID,
    user: Professional,
    session: DatabaseSession,
) -> SessionResultResponse:
    return SessionService(session).get_for_patient(user, patient_id, session_id)


@router.get("/me/progress", response_model=ProgressSummary)
def get_my_progress(
    user: PatientUser,
    session: DatabaseSession,
    period_start: datetime,
    period_end: datetime,
) -> ProgressSummary:
    patient = SessionService(session).own_patient(user)
    return ProgressService(session).summary(user, patient.id, period_start, period_end)


@router.get("/patients/{patient_id}/progress", response_model=ProgressSummary)
def get_patient_progress(
    patient_id: UUID,
    user: Professional,
    session: DatabaseSession,
    period_start: datetime,
    period_end: datetime,
) -> ProgressSummary:
    return ProgressService(session).summary(user, patient_id, period_start, period_end)
