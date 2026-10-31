"""Schema readiness and migration config; never create application tables implicitly."""

from functools import lru_cache
from pathlib import Path

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Engine

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def migration_config() -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.attributes["configure_logger"] = False
    return config


@lru_cache(maxsize=1)
def expected_heads() -> frozenset[str]:
    return frozenset(ScriptDirectory.from_config(migration_config()).get_heads())


class SchemaNotReadyError(RuntimeError):
    pass


def ensure_schema_ready(engine: Engine) -> None:
    with engine.connect() as connection:
        heads = frozenset(MigrationContext.configure(connection).get_current_heads())
        if heads != expected_heads():
            raise SchemaNotReadyError(
                "Database migrations are not at the application head"
            )
