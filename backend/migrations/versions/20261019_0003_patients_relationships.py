"""Create patients and professional relationships.

Revision ID: 20261019_0003
Revises: 20261019_0002
Create Date: 2026-10-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261019_0003"
down_revision: str | None = "20261019_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "patients",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_patients_user_id_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_patients"),
        sa.UniqueConstraint("user_id", name="uq_patients_user_id"),
    )
    op.create_index("ix_patients_email", "patients", ["email"], unique=False)

    op.create_table(
        "professional_patient_links",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("physiotherapist_id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            name="fk_professional_patient_links_patient_id_patients",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["physiotherapist_id"],
            ["users.id"],
            name="fk_professional_patient_links_physiotherapist_id_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_professional_patient_links"),
        sa.UniqueConstraint(
            "physiotherapist_id",
            "patient_id",
            name="uq_professional_patient_links_professional_patient",
        ),
    )
    op.create_index(
        "ix_professional_patient_links_patient_id",
        "professional_patient_links",
        ["patient_id"],
        unique=False,
    )
    op.create_index(
        "ix_professional_patient_links_physiotherapist_id",
        "professional_patient_links",
        ["physiotherapist_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_professional_patient_links_physiotherapist_id",
        table_name="professional_patient_links",
    )
    op.drop_index(
        "ix_professional_patient_links_patient_id",
        table_name="professional_patient_links",
    )
    op.drop_table("professional_patient_links")
    op.drop_index("ix_patients_email", table_name="patients")
    op.drop_table("patients")
