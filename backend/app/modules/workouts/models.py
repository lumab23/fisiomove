from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.auth.models import utc_now


class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="RESTRICT"), index=True
    )
    created_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT")
    )
    status: Mapped[str] = mapped_column(String(20), default="draft")
    current_revision_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey(
            "workout_revisions.id",
            ondelete="RESTRICT",
            use_alter=True,
            name="fk_workouts_current_revision",
        ),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    __table_args__ = (
        CheckConstraint("status IN ('draft', 'published', 'archived')", name="status"),
    )


class WorkoutRevision(Base):
    __tablename__ = "workout_revisions"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    workout_id: Mapped[UUID] = mapped_column(
        ForeignKey("workouts.id", ondelete="RESTRICT"), index=True
    )
    revision_number: Mapped[int] = mapped_column(Integer)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    __table_args__ = (
        UniqueConstraint("workout_id", "revision_number"),
        CheckConstraint("revision_number >= 1", name="revision_number"),
    )


class WorkoutItem(Base):
    __tablename__ = "workout_items"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("workout_revisions.id", ondelete="RESTRICT"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    exercise_id: Mapped[UUID] = mapped_column(
        ForeignKey("exercises.id", ondelete="RESTRICT")
    )
    rule_version: Mapped[str] = mapped_column(String(100))
    exercise_snapshot: Mapped[dict] = mapped_column(JSON)
    side: Mapped[str] = mapped_column(String(20))
    sets: Mapped[int] = mapped_column(Integer)
    repetitions: Mapped[int] = mapped_column(Integer)
    rest_duration_ms: Mapped[int] = mapped_column(Integer)
    professional_guidance: Mapped[str | None] = mapped_column(Text, nullable=True)
    parameters: Mapped[dict] = mapped_column(JSON)

    __table_args__ = (
        UniqueConstraint("revision_id", "position"),
        CheckConstraint("position >= 1", name="position"),
        CheckConstraint("sets > 0", name="sets"),
        CheckConstraint("repetitions > 0", name="repetitions"),
        CheckConstraint("rest_duration_ms >= 0", name="rest_duration_ms"),
        CheckConstraint("side IN ('left', 'right', 'bilateral')", name="side"),
    )
