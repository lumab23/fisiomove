"""Create workouts tables. No clinical seed data."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261020_0004"
down_revision: str | None = "20261019_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "exercises",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("allowed_sides", sa.JSON(), nullable=False),
        sa.Column("rule_version", sa.String(length=100), nullable=False),
        sa.Column("supported_parameters", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_exercises")),
        sa.UniqueConstraint("code", name=op.f("uq_exercises_code")),
    )
    op.create_table(
        "workouts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("current_revision_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('draft', 'published', 'archived')",
            name=op.f("ck_workouts_status"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_workouts_created_by_users"),
            ondelete="RESTRICT",
        ),
        # SQLite supports the forward reference inline; PostgreSQL needs ALTER
        # after workout_revisions exists.
        *(
            [
                sa.ForeignKeyConstraint(
                    ["current_revision_id"],
                    ["workout_revisions.id"],
                    name="fk_workouts_current_revision",
                    ondelete="RESTRICT",
                )
            ]
            if op.get_bind().dialect.name == "sqlite"
            else []
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            name=op.f("fk_workouts_patient_id_patients"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workouts")),
    )
    op.create_index(
        op.f("ix_workouts_patient_id"), "workouts", ["patient_id"], unique=False
    )
    op.create_table(
        "workout_revisions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workout_id", sa.Uuid(), nullable=False),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "revision_number >= 1", name=op.f("ck_workout_revisions_revision_number")
        ),
        sa.ForeignKeyConstraint(
            ["workout_id"],
            ["workouts.id"],
            name=op.f("fk_workout_revisions_workout_id_workouts"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workout_revisions")),
        sa.UniqueConstraint(
            "workout_id",
            "revision_number",
            name=op.f("uq_workout_revisions_workout_id"),
        ),
    )
    op.create_index(
        op.f("ix_workout_revisions_workout_id"),
        "workout_revisions",
        ["workout_id"],
        unique=False,
    )
    op.create_table(
        "workout_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("revision_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("exercise_id", sa.Uuid(), nullable=False),
        sa.Column("rule_version", sa.String(length=100), nullable=False),
        sa.Column("exercise_snapshot", sa.JSON(), nullable=False),
        sa.Column("side", sa.String(length=20), nullable=False),
        sa.Column("sets", sa.Integer(), nullable=False),
        sa.Column("repetitions", sa.Integer(), nullable=False),
        sa.Column("rest_duration_ms", sa.Integer(), nullable=False),
        sa.Column("professional_guidance", sa.Text(), nullable=True),
        sa.Column("parameters", sa.JSON(), nullable=False),
        sa.CheckConstraint(
            "side IN ('left', 'right', 'bilateral')", name=op.f("ck_workout_items_side")
        ),
        sa.CheckConstraint("position >= 1", name=op.f("ck_workout_items_position")),
        sa.CheckConstraint(
            "repetitions > 0", name=op.f("ck_workout_items_repetitions")
        ),
        sa.CheckConstraint(
            "rest_duration_ms >= 0", name=op.f("ck_workout_items_rest_duration_ms")
        ),
        sa.CheckConstraint("sets > 0", name=op.f("ck_workout_items_sets")),
        sa.ForeignKeyConstraint(
            ["exercise_id"],
            ["exercises.id"],
            name=op.f("fk_workout_items_exercise_id_exercises"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["revision_id"],
            ["workout_revisions.id"],
            name=op.f("fk_workout_items_revision_id_workout_revisions"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workout_items")),
        sa.UniqueConstraint(
            "revision_id", "position", name=op.f("uq_workout_items_revision_id")
        ),
    )
    op.create_index(
        op.f("ix_workout_items_revision_id"),
        "workout_items",
        ["revision_id"],
        unique=False,
    )
    if op.get_bind().dialect.name != "sqlite":
        op.create_foreign_key(
            "fk_workouts_current_revision",
            "workouts",
            "workout_revisions",
            ["current_revision_id"],
            ["id"],
            ondelete="RESTRICT",
        )


def downgrade() -> None:
    if op.get_bind().dialect.name != "sqlite":
        op.drop_constraint(
            "fk_workouts_current_revision", "workouts", type_="foreignkey"
        )
    op.drop_index(op.f("ix_workout_items_revision_id"), table_name="workout_items")
    op.drop_table("workout_items")
    op.drop_index(
        op.f("ix_workout_revisions_workout_id"), table_name="workout_revisions"
    )
    op.drop_table("workout_revisions")
    op.drop_index(op.f("ix_workouts_patient_id"), table_name="workouts")
    op.drop_table("workouts")
    op.drop_table("exercises")
