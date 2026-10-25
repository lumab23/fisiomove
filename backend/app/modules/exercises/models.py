from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.auth.models import utc_now


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    instructions: Mapped[str] = mapped_column(Text)
    allowed_sides: Mapped[list[str]] = mapped_column(JSON)
    rule_version: Mapped[str] = mapped_column(String(100))
    supported_parameters: Mapped[dict] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    approval_status: Mapped[str] = mapped_column(String(20), default="pending")
    approved_rule_version: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    approved_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    approval_document_reference: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    __table_args__ = (
        CheckConstraint(
            "approval_status IN ('pending', 'approved', 'revoked')",
            name="approval_status",
        ),
        CheckConstraint(
            "approval_status != 'approved' OR "
            "(approved_rule_version IS NOT NULL AND approved_by_id IS NOT NULL "
            "AND approved_at IS NOT NULL "
            "AND approval_document_reference IS NOT NULL)",
            name="approved_evidence",
        ),
    )


class ExerciseApprovalEvent(Base):
    """Append-only evidence log; it does not constitute clinical approval itself."""

    __tablename__ = "exercise_approval_events"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    exercise_id: Mapped[UUID] = mapped_column(
        ForeignKey("exercises.id", ondelete="RESTRICT"), index=True
    )
    rule_version: Mapped[str] = mapped_column(String(100))
    decision: Mapped[str] = mapped_column(String(20))
    decided_by_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT")
    )
    decided_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    document_reference: Mapped[str] = mapped_column(String(500))

    __table_args__ = (
        CheckConstraint("decision IN ('approved', 'revoked')", name="decision"),
    )
