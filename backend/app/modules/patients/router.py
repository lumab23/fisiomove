from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.modules.auth.dependencies import require_role
from app.modules.auth.models import User, UserRole
from app.modules.patients.authorization import get_own_patient
from app.modules.patients.schemas import (
    PatientAccessRequest,
    PatientAccessResponse,
    PatientCreate,
    PatientPage,
    PatientResponse,
    PatientSelfProfile,
    PatientUpdate,
)
from app.modules.patients.services import PatientService

router = APIRouter(prefix="/patients", tags=["patients"])
me_router = APIRouter(tags=["patients"])
Physiotherapist = Annotated[User, Depends(require_role(UserRole.PHYSIOTHERAPIST))]
PatientUser = Annotated[User, Depends(require_role(UserRole.PATIENT))]
DatabaseSession = Annotated[Session, Depends(get_db_session, scope="function")]


@me_router.get("/me/profile", response_model=PatientSelfProfile)
def get_my_profile(user: PatientUser, session: DatabaseSession) -> PatientSelfProfile:
    patient = get_own_patient(session, user)
    return PatientSelfProfile(full_name=patient.full_name)


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


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    patient_id: UUID,
    professional: Physiotherapist,
    session: DatabaseSession,
) -> Response:
    PatientService(session).delete(professional.id, patient_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
