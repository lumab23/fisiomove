from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.auth.models import User, UserRole
from app.modules.notes.schemas import NoteCreate, NotePage, NoteResponse, NoteUpdate
from app.modules.notes.services import NoteService

router = APIRouter(tags=["notes"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
Professional = Annotated[User, Depends(require_role(UserRole.PHYSIOTHERAPIST))]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.post(
    "/patients/{patient_id}/notes", response_model=NoteResponse, status_code=201
)
def create_note(
    patient_id: UUID, payload: NoteCreate, user: Professional, session: DatabaseSession
) -> NoteResponse:
    return NoteService(session).create(user, patient_id, payload)


@router.get("/patients/{patient_id}/notes", response_model=NotePage)
def list_notes(
    patient_id: UUID,
    user: CurrentUser,
    session: DatabaseSession,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> NotePage:
    return NoteService(session).list(user, patient_id, page, page_size)


@router.patch("/notes/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: UUID, payload: NoteUpdate, user: Professional, session: DatabaseSession
) -> NoteResponse:
    return NoteService(session).update(user, note_id, payload)
