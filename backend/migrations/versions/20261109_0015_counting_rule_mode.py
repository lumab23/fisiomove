"""Add the optional demonstration counting rule to workout items (DEC-013).

`workout_items.counting_rule` starts NULL for every existing item, so published
workouts keep manual counting. The per-item `counting_mode` of a session result
lives inside the `session_results.items` JSON (there is no item table); stored
results without it are read as `manual`, so no data is rewritten here.

Revision ID: 20261109_0015
Revises: 20261106_0014
Create Date: 2026-11-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261109_0015"
down_revision: str | None = "20261106_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("workout_items") as batch_op:
        batch_op.add_column(
            sa.Column("counting_rule", sa.String(length=100), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("workout_items") as batch_op:
        batch_op.drop_column("counting_rule")
