from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.modules.auth.dependencies import require_role
from app.modules.auth.models import User, UserRole
from app.modules.patients.schemas import (
    PatientAccessRequest,
    PatientAccessResponse,
    PatientCreate,
    PatientPage,
    PatientResponse,
    PatientUpdate,
)
from app.modules.patients.services import PatientService

router = APIRouter(prefix="/patients", tags=["patients"])
Physiotherapist = Annotated[User, Depends(require_role(UserRole.PHYSIOTHERAPIST))]
DatabaseSession = Annotated[Session, Depends(get_db_session)]


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreate,
    professional: Physiotherapist,
    session: DatabaseSession,
) -> PatientResponse:
    return PatientService(session).create(professional.id, payload)


@router.get("", response_model=PatientPage)
def list_patients(
    professional: Physiotherapist,
    session: DatabaseSession,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PatientPage:
    return PatientService(session).list(professional.id, page=page, page_size=page_size)


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    patient_id: UUID,
    professional: Physiotherapist,
    session: DatabaseSession,
) -> PatientResponse:
    return PatientService(session).get(professional.id, patient_id)


@router.patch("/{patient_id}", response_model=PatientResponse)
def update_patient(
    patient_id: UUID,
    payload: PatientUpdate,
    professional: Physiotherapist,
    session: DatabaseSession,
) -> PatientResponse:
    return PatientService(session).update(professional.id, patient_id, payload)


@router.post("/{patient_id}/access", response_model=PatientAccessResponse)
def manage_patient_access(
    patient_id: UUID,
    payload: PatientAccessRequest,
    professional: Physiotherapist,
    session: DatabaseSession,
) -> PatientAccessResponse:
    return PatientService(session).manage_access(
        professional.id, patient_id, payload.operation
    )
