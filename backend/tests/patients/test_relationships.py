from collections.abc import Callable

import pytest
from fastapi import FastAPI
from sqlalchemy.exc import IntegrityError

from app.core.errors import ApiError
from app.modules.auth.models import User, UserRole
from app.modules.patients.authorization import get_authorized_patient
from app.modules.patients.models import Patient, ProfessionalPatientLink


def test_link_integrity_and_reusable_authorization(
    patients_app: FastAPI,
    create_user: Callable[..., User],
) -> None:
    owner = create_user(email="owner@example.com", role=UserRole.PHYSIOTHERAPIST)
    other = create_user(email="other@example.com", role=UserRole.PHYSIOTHERAPIST)
    with patients_app.state.database.session() as session:
        patient = Patient(full_name="Linked Patient")
        session.add(patient)
        session.flush()
        session.add(
            ProfessionalPatientLink(
                physiotherapist_id=owner.id,
                patient_id=patient.id,
            )
        )
        session.flush()
        assert get_authorized_patient(session, owner.id, patient.id).id == patient.id
        with pytest.raises(ApiError) as error:
            get_authorized_patient(session, other.id, patient.id)
        assert error.value.status_code == 404

    with pytest.raises(IntegrityError):
        with patients_app.state.database.session() as session:
            session.add(
                ProfessionalPatientLink(
                    physiotherapist_id=owner.id,
                    patient_id=patient.id,
                )
            )
            session.flush()
