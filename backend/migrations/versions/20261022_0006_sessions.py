"""Persist idempotent session results and immutable workout snapshots."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261022_0006"
down_revision: str | None = "20261020_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "session_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("client_session_id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("workout_id", sa.Uuid(), nullable=False),
        sa.Column("workout_revision_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("active_duration_ms", sa.Integer(), nullable=False),
        sa.Column("low_confidence_summary", sa.JSON(), nullable=True),
        sa.Column("feedback_summary", sa.JSON(), nullable=True),
        sa.Column("workout_snapshot", sa.JSON(), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('completed', 'interrupted')",
            name=op.f("ck_session_results_status"),
        ),
        sa.CheckConstraint(
            "active_duration_ms >= 0",
            name=op.f("ck_session_results_active_duration_ms"),
        ),
        sa.CheckConstraint(
            "finished_at >= started_at", name=op.f("ck_session_results_time_range")
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            name=op.f("fk_session_results_patient_id_patients"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["workout_id"],
            ["workouts.id"],
            name=op.f("fk_session_results_workout_id_workouts"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["workout_revision_id"],
            ["workout_revisions.id"],
            name=op.f("fk_session_results_workout_revision_id_workout_revisions"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_session_results")),
    )
    op.create_index(
        "uq_session_results_patient_client_session",
        "session_results",
        ["patient_id", "client_session_id"],
        unique=True,
    )
    op.create_index(
        "ix_session_results_patient_started",
        "session_results",
        ["patient_id", "started_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_session_results_patient_started", table_name="session_results")
    op.drop_index(
        "uq_session_results_patient_client_session", table_name="session_results"
    )
    op.drop_table("session_results")
