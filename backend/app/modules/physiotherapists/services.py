from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.modules.auth.models import User, utc_now
from app.modules.auth.repositories import SqlAlchemyUserRepository
from app.modules.patients.authorization import get_own_patient
from app.modules.patients.models import ProfessionalPatientLink
from app.modules.physiotherapists.models import PhysiotherapistProfile
from app.modules.physiotherapists.schemas import (
    LinkedPhysiotherapistResponse,
    PhysiotherapistProfileResponse,
    PhysiotherapistProfileUpdate,
)


class PhysiotherapistProfileService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_own(self, professional: User) -> PhysiotherapistProfileResponse:
        profile = self._session.get(PhysiotherapistProfile, professional.id)
        return PhysiotherapistProfileResponse(
            full_name=profile.full_name if profile else None
        )

    def set_own(
        self,
        professional: User,
        payload: PhysiotherapistProfileUpdate,
    ) -> PhysiotherapistProfileResponse:
        # Lock the account row first (same order as auth) so concurrent first
        # writes serialize instead of racing on the profile primary key.
        SqlAlchemyUserRepository(self._session).get_by_id_for_update(professional.id)
        profile = self._session.get(PhysiotherapistProfile, professional.id)
        if profile is None:
            profile = PhysiotherapistProfile(
                user_id=professional.id, full_name=payload.full_name
            )
            self._session.add(profile)
        else:
            profile.full_name = payload.full_name
            profile.updated_at = utc_now()
        self._session.flush()
        return PhysiotherapistProfileResponse(full_name=profile.full_name)

    def get_for_patient(self, patient_user: User) -> LinkedPhysiotherapistResponse:
        """Resolve the patient's oldest active link; expose only the name."""
        patient = get_own_patient(self._session, patient_user)
        physiotherapist_id = self._session.scalar(
            select(ProfessionalPatientLink.physiotherapist_id)
            .where(
                ProfessionalPatientLink.patient_id == patient.id,
                ProfessionalPatientLink.is_active.is_(True),
            )
            .order_by(ProfessionalPatientLink.created_at, ProfessionalPatientLink.id)
            .limit(1)
        )
        if physiotherapist_id is None:
            raise ApiError(
                status_code=404,
                code="physiotherapist_not_found",
                message="No active physiotherapist is linked to this patient.",
            )
        profile = self._session.get(PhysiotherapistProfile, physiotherapist_id)
        return LinkedPhysiotherapistResponse(
            full_name=profile.full_name if profile else None
        )
