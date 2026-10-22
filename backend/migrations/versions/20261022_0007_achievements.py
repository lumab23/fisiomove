"""Store unique achievements for exactly completed session goals."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261022_0007"
down_revision: str | None = "20261022_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "achievements",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("session_result_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("achieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            name=op.f("fk_achievements_patient_id_patients"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["session_result_id"],
            ["session_results.id"],
            name=op.f("fk_achievements_session_result_id_session_results"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_achievements")),
    )
    op.create_index(
        "uq_achievements_patient_session_code",
        "achievements",
        ["patient_id", "session_result_id", "code"],
        unique=True,
    )
    op.create_index(
        "ix_achievements_patient_achieved",
        "achievements",
        ["patient_id", "achieved_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_achievements_patient_achieved", table_name="achievements")
    op.drop_index("uq_achievements_patient_session_code", table_name="achievements")
    op.drop_table("achievements")
