"""Store library images copied at import time (DEC-010), without backfill.

Existing imported exercises receive images only through the explicit CLI
(`python -m app.modules.exercise_library.cli backfill-images`). Downgrade drops
the copied bytes; published snapshots keep image URLs that will answer 404.

Revision ID: 20261106_0013
Revises: 20261106_0012
Create Date: 2026-11-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261106_0013"
down_revision: str | None = "20261106_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "exercise_images",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("exercise_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(length=50), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("source_url", sa.String(length=500), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "position >= 1 AND position <= 6", name=op.f("ck_exercise_images_position")
        ),
        sa.CheckConstraint(
            "content_type IN ('image/png', 'image/jpeg', 'image/webp')",
            name=op.f("ck_exercise_images_content_type"),
        ),
        sa.CheckConstraint(
            "byte_size > 0 AND byte_size <= 2097152",
            name=op.f("ck_exercise_images_byte_size"),
        ),
        sa.ForeignKeyConstraint(
            ["exercise_id"],
            ["exercises.id"],
            name=op.f("fk_exercise_images_exercise_id_exercises"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_exercise_images")),
        sa.UniqueConstraint(
            "exercise_id", "position", name=op.f("uq_exercise_images_exercise_id")
        ),
    )


def downgrade() -> None:
    op.drop_table("exercise_images")
