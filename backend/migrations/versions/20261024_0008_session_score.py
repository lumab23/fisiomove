"""Persist deterministic session scores and backfill existing results."""

import json
from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from alembic import op

revision: str = "20261024_0008"
down_revision: str | None = "20261022_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _json(value: Any) -> Any:
    return json.loads(value) if isinstance(value, str) else value


def _score(snapshot: Any, results: Any) -> int:
    snapshot = _json(snapshot) or {}
    results = _json(results) or []
    prescribed = {
        str(item["id"]): int(item["sets"]) * int(item["repetitions"])
        for item in snapshot.get("items", [])
    }
    return sum(
        min(
            max(int(item.get("completed_repetitions", 0)), 0),
            prescribed.get(str(item.get("workout_item_id")), 0),
        )
        for item in results
    )


def upgrade() -> None:
    with op.batch_alter_table("session_results") as batch_op:
        batch_op.add_column(
            sa.Column("score", sa.Integer(), nullable=True, server_default=sa.text("0"))
        )

    bind = op.get_bind()
    metadata = sa.MetaData()
    results = sa.Table("session_results", metadata, autoload_with=bind)
    for row in bind.execute(
        sa.select(results.c.id, results.c.workout_snapshot, results.c["items"])
    ).mappings():
        bind.execute(
            results.update()
            .where(results.c.id == row["id"])
            .values(score=_score(row["workout_snapshot"], row["items"]))
        )

    with op.batch_alter_table("session_results") as batch_op:
        batch_op.alter_column(
            "score", existing_type=sa.Integer(), nullable=False, server_default=None
        )
        batch_op.create_check_constraint(op.f("ck_session_results_score"), "score >= 0")


def downgrade() -> None:
    with op.batch_alter_table("session_results") as batch_op:
        batch_op.drop_constraint(op.f("ck_session_results_score"), type_="check")
        batch_op.drop_column("score")
