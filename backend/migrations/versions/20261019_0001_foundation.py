"""Establish the database migration foundation.

Revision ID: 20261019_0001
Revises: None
Create Date: 2026-10-19
"""

from collections.abc import Sequence

revision: str = "20261019_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create no domain tables until their owning modules are implemented."""


def downgrade() -> None:
    """Remove no domain tables because this revision only establishes a head."""
