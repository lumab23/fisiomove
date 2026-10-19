from dataclasses import dataclass
from math import ceil
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.modules.auth.models import User, utc_now
from app.modules.auth.repositories import SqlAlchemyUserRepository
from app.modules.auth.services import PatientAccountService, normalize_email
from app.modules.patients.authorization import get_authorized_patient
from app.modules.patients.models import Patient, ProfessionalPatientLink
from app.modules.patients.repositories import SqlAlchemyPatientRepository
from app.modules.patients.schemas import (
    PatientAccessOperation,
    PatientAccessResponse,
    PatientCreate,
    PatientPage,
    PatientResponse,
    PatientUpdate,
)


@dataclass(frozen=True)
class PatientWithAccount:
    patient: Patient
    user: User | None


class PatientService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._patients = SqlAlchemyPatientRepository(session)
        self._users = SqlAlchemyUserRepository(session)
        self._accounts = PatientAccountService(session)

    def create(
        self, physiotherapist_id: UUID, payload: PatientCreate
    ) -> PatientResponse:
        patient = self._patients.add(
            Patient(
                full_name=payload.full_name,
                email=normalize_email(str(payload.email)) if payload.email else None,
                phone=payload.phone,
            )
        )
        self._patients.add_link(
            ProfessionalPatientLink(
                physiotherapist_id=physiotherapist_id,
                patient_id=patient.id,
            )
        )
        return self._response(PatientWithAccount(patient, None))

    def list(
        self,
        physiotherapist_id: UUID,
        *,
        page: int,
        page_size: int,
    ) -> PatientPage:
        patients, total = self._patients.list_linked(
            physiotherapist_id, page=page, page_size=page_size
        )
        items = [
            self._response(PatientWithAccount(patient, self._user_for(patient)))
            for patient in patients
        ]
        return PatientPage(
            items=items,
            page=page,
            page_size=page_size,
            total=total,
            pages=ceil(total / page_size),
        )

    def get(self, physiotherapist_id: UUID, patient_id: UUID) -> PatientResponse:
        patient = get_authorized_patient(self._session, physiotherapist_id, patient_id)
        return self._response(PatientWithAccount(patient, self._user_for(patient)))

    def update(
        self,
        physiotherapist_id: UUID,
        patient_id: UUID,
        payload: PatientUpdate,
    ) -> PatientResponse:
        patient = get_authorized_patient(
            self._session, physiotherapist_id, patient_id, for_update=True
        )
        account = self._user_for(patient)
        fields = payload.model_fields_set

        if "full_name" in fields:
            patient.full_name = payload.full_name  # type: ignore[assignment]
        if "phone" in fields:
            patient.phone = payload.phone
        if "email" in fields:
            if payload.email is None and account is not None:
                raise ApiError(
                    status_code=409,
                    code="patient_email_required_for_access",
                    message="A patient with account access must keep an email address.",
                )
            patient.email = (
                normalize_email(str(payload.email))
                if payload.email is not None
                else None
            )
            if account is not None and patient.email is not None:
                account = self._accounts.change_email(account.id, patient.email)
        if "is_active" in fields and payload.is_active != patient.is_active:
            patient.is_active = bool(payload.is_active)
            if not patient.is_active and account is not None:
                self._accounts.deactivate_access(account.id)
                account = self._users.get_by_id(account.id)

        patient.updated_at = utc_now()
        self._session.flush()
        return self._response(PatientWithAccount(patient, account))

    def manage_access(
        self,
        physiotherapist_id: UUID,
        patient_id: UUID,
        operation: PatientAccessOperation,
    ) -> PatientAccessResponse:
        patient = get_authorized_patient(
            self._session, physiotherapist_id, patient_id, for_update=True
        )
        if not patient.is_active:
            raise ApiError(
                status_code=409,
                code="patient_inactive",
                message="Reactivate the patient before managing account access.",
            )
        if patient.email is None:
            raise ApiError(
                status_code=409,
                code="patient_email_required",
                message="Add an email address before creating account access.",
            )

        account = self._user_for(patient)
        if account is None:
            if operation is PatientAccessOperation.RESET_TEMPORARY_PASSWORD:
                raise ApiError(
                    status_code=409,
                    code="patient_access_not_created",
                    message="Create patient access before resetting its credential.",
                )
            credential = self._accounts.create_access(patient.email)
            patient.user_id = credential.user_id
            action = "created"
        elif operation is PatientAccessOperation.ACTIVATE:
            if account.is_active:
                raise ApiError(
                    status_code=409,
                    code="patient_access_already_active",
                    message="Patient account access is already active.",
                )
            credential = self._accounts.activate_access(account.id)
            action = "activated"
        else:
            credential = self._accounts.reset_temporary_password(account.id)
            action = "temporary_password_reset"

        patient.updated_at = utc_now()
        self._session.flush()
        return PatientAccessResponse(
            patient_id=patient.id,
            user_id=credential.user_id,
            email=credential.email,
            temporary_password=credential.temporary_password,
            action=action,
        )

    def _user_for(self, patient: Patient) -> User | None:
        return self._users.get_by_id(patient.user_id) if patient.user_id else None

    @staticmethod
    def _response(value: PatientWithAccount) -> PatientResponse:
        account = value.user
        return PatientResponse(
            id=value.patient.id,
            full_name=value.patient.full_name,
            email=value.patient.email,
            phone=value.patient.phone,
            is_active=value.patient.is_active,
            has_access=account is not None,
            access_is_active=bool(account and account.is_active),
            must_change_password=bool(account and account.must_change_password),
            created_at=value.patient.created_at,
            updated_at=value.patient.updated_at,
        )
