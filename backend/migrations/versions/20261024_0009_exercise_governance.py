"""Add auditable clinical approval evidence without seeding exercises."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261024_0009"
down_revision: str | None = "20261024_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("exercises") as batch_op:
        batch_op.add_column(
            sa.Column(
                "approval_status",
                sa.String(length=20),
                nullable=False,
                server_default="pending",
            )
        )
        batch_op.add_column(
            sa.Column("approved_rule_version", sa.String(length=100), nullable=True)
        )
        batch_op.add_column(sa.Column("approved_by_id", sa.Uuid(), nullable=True))
        batch_op.add_column(
            sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "approval_document_reference", sa.String(length=500), nullable=True
            )
        )

    with op.batch_alter_table("exercises") as batch_op:
        batch_op.create_check_constraint(
            op.f("ck_exercises_approval_status"),
            "approval_status IN ('pending', 'approved', 'revoked')",
        )
        batch_op.create_check_constraint(
            op.f("ck_exercises_approved_evidence"),
            "approval_status != 'approved' OR "
            "(approved_rule_version IS NOT NULL AND approved_by_id IS NOT NULL "
            "AND approved_at IS NOT NULL "
            "AND approval_document_reference IS NOT NULL)",
        )
        batch_op.create_foreign_key(
            op.f("fk_exercises_approved_by_id_users"),
            "users",
            ["approved_by_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        batch_op.alter_column(
            "approval_status",
            existing_type=sa.String(length=20),
            server_default=None,
        )

    op.create_table(
        "exercise_approval_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("exercise_id", sa.Uuid(), nullable=False),
        sa.Column("rule_version", sa.String(length=100), nullable=False),
        sa.Column("decision", sa.String(length=20), nullable=False),
        sa.Column("decided_by_id", sa.Uuid(), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("document_reference", sa.String(length=500), nullable=False),
        sa.CheckConstraint(
            "decision IN ('approved', 'revoked')",
            name=op.f("ck_exercise_approval_events_decision"),
        ),
        sa.ForeignKeyConstraint(
            ["decided_by_id"],
            ["users.id"],
            name=op.f("fk_exercise_approval_events_decided_by_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["exercise_id"],
            ["exercises.id"],
            name=op.f("fk_exercise_approval_events_exercise_id_exercises"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_exercise_approval_events")),
    )
    op.create_index(
        op.f("ix_exercise_approval_events_exercise_id"),
        "exercise_approval_events",
        ["exercise_id"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_exercise_approval_events_exercise_id"),
        table_name="exercise_approval_events",
    )
    op.drop_table("exercise_approval_events")
    with op.batch_alter_table("exercises") as batch_op:
        batch_op.drop_constraint(
            op.f("fk_exercises_approved_by_id_users"), type_="foreignkey"
        )
        batch_op.drop_constraint(op.f("ck_exercises_approved_evidence"), type_="check")
        batch_op.drop_constraint(op.f("ck_exercises_approval_status"), type_="check")
        batch_op.drop_column("approval_document_reference")
        batch_op.drop_column("approved_at")
        batch_op.drop_column("approved_by_id")
        batch_op.drop_column("approved_rule_version")
        batch_op.drop_column("approval_status")
