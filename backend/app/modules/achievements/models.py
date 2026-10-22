from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.auth.models import utc_now


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False
    )
    session_result_id: Mapped[UUID] = mapped_column(
        ForeignKey("session_results.id", ondelete="RESTRICT"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    achieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    __table_args__ = (
        Index(
            "uq_achievements_patient_session_code",
            "patient_id",
            "session_result_id",
            "code",
            unique=True,
        ),
        Index("ix_achievements_patient_achieved", "patient_id", "achieved_at"),
    )
