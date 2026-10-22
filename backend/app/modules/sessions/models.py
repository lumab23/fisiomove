from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.auth.models import utc_now


class SessionResult(Base):
    __tablename__ = "session_results"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    client_session_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False
    )
    workout_id: Mapped[UUID] = mapped_column(
        ForeignKey("workouts.id", ondelete="RESTRICT"), nullable=False
    )
    workout_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("workout_revisions.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    finished_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    active_duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    low_confidence_summary: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True
    )
    feedback_summary: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True
    )
    workout_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    items: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('completed', 'interrupted')", name="status"
        ),
        CheckConstraint("active_duration_ms >= 0", name="active_duration_ms"),
        CheckConstraint("finished_at >= started_at", name="time_range"),
        Index(
            "uq_session_results_patient_client_session",
            "patient_id",
            "client_session_id",
            unique=True,
        ),
        Index("ix_session_results_patient_started", "patient_id", "started_at"),
    )
