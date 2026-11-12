"""Add the optional pt-BR text of an exercise (DEC-011), without backfill.

The original `name`/`instructions` stay untouched. Downgrade drops the
translations written by physiotherapists; published snapshots keep their copy.

Revision ID: 20261106_0014
Revises: 20261106_0013
Create Date: 2026-11-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261106_0014"
down_revision: str | None = "20261106_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LOCALIZATION_COMPLETE = (
    "(name_pt_br IS NULL AND instructions_pt_br IS NULL "
    "AND translated_by_id IS NULL AND translated_at IS NULL) OR "
    "(name_pt_br IS NOT NULL AND instructions_pt_br IS NOT NULL "
    "AND translated_by_id IS NOT NULL AND translated_at IS NOT NULL)"
)


def upgrade() -> None:
    with op.batch_alter_table("exercises") as batch_op:
        batch_op.add_column(
            sa.Column("name_pt_br", sa.String(length=200), nullable=True)
        )
        batch_op.add_column(sa.Column("instructions_pt_br", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("translated_by_id", sa.Uuid(), nullable=True))
        batch_op.add_column(
            sa.Column("translated_at", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.create_foreign_key(
            op.f("fk_exercises_translated_by_id_users"),
            "users",
            ["translated_by_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        batch_op.create_check_constraint(
            op.f("ck_exercises_localization_complete"), LOCALIZATION_COMPLETE
        )


def downgrade() -> None:
    with op.batch_alter_table("exercises") as batch_op:
        batch_op.drop_constraint(
            op.f("ck_exercises_localization_complete"), type_="check"
        )
        batch_op.drop_constraint(
            op.f("fk_exercises_translated_by_id_users"), type_="foreignkey"
        )
        batch_op.drop_column("translated_at")
        batch_op.drop_column("translated_by_id")
        batch_op.drop_column("instructions_pt_br")
        batch_op.drop_column("name_pt_br")
