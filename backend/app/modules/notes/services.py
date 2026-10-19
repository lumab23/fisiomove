from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.modules.auth.models import User, UserRole, utc_now
from app.modules.notes.models import Note
from app.modules.notes.schemas import (
    NoteCreate,
    NotePage,
    NoteResponse,
    NoteUpdate,
    Visibility,
)
from app.modules.patients.authorization import get_authorized_patient
from app.modules.patients.models import Patient


class NoteService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def authorize(self, user: User, patient_id: UUID, *, write: bool = False) -> None:
        if user.role == UserRole.PHYSIOTHERAPIST:
            get_authorized_patient(self.session, user.id, patient_id)
            return
        if not write and user.role == UserRole.PATIENT:
            patient = self.session.scalar(
                select(Patient).where(
                    Patient.id == patient_id,
                    Patient.user_id == user.id,
                    Patient.is_active.is_(True),
                )
            )
            if patient is not None:
                return
        raise ApiError(
            status_code=404,
            code="patient_not_found",
            message="The patient was not found.",
        )

    def create(self, user: User, patient_id: UUID, payload: NoteCreate) -> NoteResponse:
        self.authorize(user, patient_id, write=True)
        note = Note(
            patient_id=patient_id,
            author_id=user.id,
            content=payload.content,
            visibility=payload.visibility.value,
        )
        self.session.add(note)
        self.session.flush()
        return NoteResponse.model_validate(note)

    def list(self, user: User, patient_id: UUID, page: int, page_size: int) -> NotePage:
        self.authorize(user, patient_id)
        query = select(Note).where(Note.patient_id == patient_id)
        if user.role == UserRole.PATIENT:
            query = query.where(Note.visibility == Visibility.PATIENT_VISIBLE.value)
        total = (
            self.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        )
        notes = self.session.scalars(
            query.order_by(Note.created_at.desc(), Note.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return NotePage(
            items=[NoteResponse.model_validate(x) for x in notes],
            page=page,
            page_size=page_size,
            total=total,
            pages=(total + page_size - 1) // page_size,
        )

    def update(self, user: User, note_id: UUID, payload: NoteUpdate) -> NoteResponse:
        note = self.session.scalar(
            select(Note).where(Note.id == note_id).with_for_update()
        )
        if note is None:
            raise ApiError(
                status_code=404,
                code="note_not_found",
                message="The note was not found.",
            )
        self.authorize(user, note.patient_id, write=True)
        if note.author_id != user.id:
            raise ApiError(
                status_code=403,
                code="note_author_required",
                message="Only the author can edit this note.",
            )
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(
                note, field, value.value if isinstance(value, Visibility) else value
            )
        note.updated_at = utc_now()
        self.session.flush()
        return NoteResponse.model_validate(note)
