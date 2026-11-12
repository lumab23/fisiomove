from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.patients.models import Patient, ProfessionalPatientLink


class SqlAlchemyPatientRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, patient: Patient) -> Patient:
        self._session.add(patient)
        self._session.flush()
        return patient

    def add_link(self, link: ProfessionalPatientLink) -> ProfessionalPatientLink:
        self._session.add(link)
        self._session.flush()
        return link

    def list_linked(
        self,
        physiotherapist_id: UUID,
        *,
        page: int,
        page_size: int,
    ) -> tuple[Sequence[Patient], int]:
        linked = (
            select(Patient)
            .join(
                ProfessionalPatientLink,
                ProfessionalPatientLink.patient_id == Patient.id,
            )
            .where(
                ProfessionalPatientLink.physiotherapist_id == physiotherapist_id,
                ProfessionalPatientLink.is_active.is_(True),
            )
        )
        total = (
            self._session.scalar(select(func.count()).select_from(linked.subquery()))
            or 0
        )
        items = self._session.scalars(
            linked.order_by(Patient.created_at.desc(), Patient.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        return items, total
