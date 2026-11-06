from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.modules.auth.models import User, utc_now
from app.modules.physiotherapists.models import PhysiotherapistProfile

# Limits approved for library images (DEC-010).
MAX_IMAGES_PER_EXERCISE = 6
MAX_IMAGE_BYTES = 2 * 1024 * 1024
IMAGE_CONTENT_TYPES = ("image/png", "image/jpeg", "image/webp")

LOCALIZATION_COMPLETE = (
    "(name_pt_br IS NULL AND instructions_pt_br IS NULL "
    "AND translated_by_id IS NULL AND translated_at IS NULL) OR "
    "(name_pt_br IS NOT NULL AND instructions_pt_br IS NOT NULL "
    "AND translated_by_id IS NOT NULL AND translated_at IS NOT NULL)"
)

PROVENANCE_COMPLETE = (
    "(source IS NULL AND source_external_id IS NULL AND source_url IS NULL "
    "AND source_license IS NULL) OR "
    "(source IS NOT NULL AND source_external_id IS NOT NULL "
    "AND source_url IS NOT NULL AND source_license IS NOT NULL)"
)


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
    # Provenance of material added from an external reference library (DEC-006).
    # All four are NULL for exercises created inside FisioMove.
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_external_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_license: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Portuguese text written or reviewed by a physiotherapist (DEC-011). The
    # original `name`/`instructions` are preserved; all four are NULL or all set.
    name_pt_br: Mapped[str | None] = mapped_column(String(200), nullable=True)
    instructions_pt_br: Mapped[str | None] = mapped_column(Text, nullable=True)
    translated_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    translated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    # Image rows without their bytes (`ExerciseImage.data` is deferred).
    images: Mapped[list["ExerciseImage"]] = relationship(
        order_by="ExerciseImage.position", lazy="selectin"
    )
    translator: Mapped[User | None] = relationship(
        foreign_keys=[translated_by_id], viewonly=True
    )
    translator_profile: Mapped[PhysiotherapistProfile | None] = relationship(
        primaryjoin=lambda: Exercise.translated_by_id == PhysiotherapistProfile.user_id,
        foreign_keys=lambda: [Exercise.translated_by_id],
        viewonly=True,
        uselist=False,
    )

    __table_args__ = (
        CheckConstraint(
            "approval_status IN ('pending', 'approved', 'revoked')",
            name="approval_status",
        ),
        CheckConstraint(PROVENANCE_COMPLETE, name="provenance_complete"),
        CheckConstraint(LOCALIZATION_COMPLETE, name="localization_complete"),
        Index(
            "uq_exercises_source_external_id",
            "source",
            "source_external_id",
            unique=True,
        ),
        CheckConstraint(
            "approval_status != 'approved' OR "
            "(approved_rule_version IS NOT NULL AND approved_by_id IS NOT NULL "
            "AND approved_at IS NOT NULL "
            "AND approval_document_reference IS NOT NULL)",
            name="approved_evidence",
        ),
    )


class ExerciseImage(Base):
    """Library image copied at import time (DEC-010); never fetched by the app."""

    __tablename__ = "exercise_images"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    exercise_id: Mapped[UUID] = mapped_column(
        ForeignKey("exercises.id", ondelete="RESTRICT")
    )
    position: Mapped[int] = mapped_column(Integer)
    content_type: Mapped[str] = mapped_column(String(50))
    sha256: Mapped[str] = mapped_column(String(64))
    source_url: Mapped[str] = mapped_column(String(500))
    data: Mapped[bytes] = mapped_column(LargeBinary, deferred=True)
    byte_size: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    __table_args__ = (
        UniqueConstraint("exercise_id", "position"),
        CheckConstraint(
            f"position >= 1 AND position <= {MAX_IMAGES_PER_EXERCISE}",
            name="position",
        ),
        CheckConstraint(
            "content_type IN ('image/png', 'image/jpeg', 'image/webp')",
            name="content_type",
        ),
        CheckConstraint(
            f"byte_size > 0 AND byte_size <= {MAX_IMAGE_BYTES}", name="byte_size"
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
