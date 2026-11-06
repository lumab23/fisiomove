"""Add nullable provenance to exercises (DEC-006), without backfill.

Downgrade drops only the provenance columns: exercises already imported from the
library stay in the catalog without their CC BY-NC attribution, so remove or
re-attribute them before downgrading a database that contains imports.

Revision ID: 20261106_0012
Revises: 20261106_0011
Create Date: 2026-11-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261106_0012"
down_revision: str | None = "20261106_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PROVENANCE_COMPLETE = (
    "(source IS NULL AND source_external_id IS NULL AND source_url IS NULL "
    "AND source_license IS NULL) OR "
    "(source IS NOT NULL AND source_external_id IS NOT NULL "
    "AND source_url IS NOT NULL AND source_license IS NOT NULL)"
)


def upgrade() -> None:
    with op.batch_alter_table("exercises") as batch_op:
        batch_op.add_column(sa.Column("source", sa.String(length=50), nullable=True))
        batch_op.add_column(
            sa.Column("source_external_id", sa.String(length=128), nullable=True)
        )
        batch_op.add_column(
            sa.Column("source_url", sa.String(length=500), nullable=True)
        )
        batch_op.add_column(
            sa.Column("source_license", sa.String(length=50), nullable=True)
        )
        batch_op.create_check_constraint(
            op.f("ck_exercises_provenance_complete"), PROVENANCE_COMPLETE
        )
    op.create_index(
        "uq_exercises_source_external_id",
        "exercises",
        ["source", "source_external_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_exercises_source_external_id", table_name="exercises")
    with op.batch_alter_table("exercises") as batch_op:
        batch_op.drop_constraint(
            op.f("ck_exercises_provenance_complete"), type_="check"
        )
        batch_op.drop_column("source_license")
        batch_op.drop_column("source_url")
        batch_op.drop_column("source_external_id")
        batch_op.drop_column("source")
