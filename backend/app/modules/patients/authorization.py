from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.modules.auth.models import User
from app.modules.patients.models import Patient, ProfessionalPatientLink


def get_authorized_patient(
    session: Session,
    physiotherapist_id: UUID,
    patient_id: UUID,
    *,
    for_update: bool = False,
) -> Patient:
    """Return a patient only when the authenticated professional has an active link."""
    statement = (
        select(Patient)
        .join(
            ProfessionalPatientLink,
            ProfessionalPatientLink.patient_id == Patient.id,
        )
        .where(
            Patient.id == patient_id,
            ProfessionalPatientLink.physiotherapist_id == physiotherapist_id,
            ProfessionalPatientLink.is_active.is_(True),
        )
    )
    if for_update:
        statement = statement.with_for_update()
    patient = session.scalar(statement)
    if patient is None:
        raise ApiError(
            status_code=404,
            code="patient_not_found",
            message="The patient was not found.",
        )
    return patient


def get_own_patient(session: Session, user: User) -> Patient:
    """Return the active patient record linked to the authenticated user."""
    patient = session.scalar(
        select(Patient).where(Patient.user_id == user.id, Patient.is_active.is_(True))
    )
    if patient is None:
        raise ApiError(
            status_code=404,
            code="patient_not_found",
            message="The patient was not found.",
        )
    return patient
