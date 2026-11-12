"""Run as a deployment job: serialize migrators, upgrade, then check schema drift."""

from alembic import command
from sqlalchemy import text

from app.core.config import get_settings
from app.db.migrations import migration_config
from app.db.session import Database

MIGRATION_LOCK = 461624837419


def migrate() -> None:
    settings = get_settings()
    database = Database.from_settings(settings)
    config = migration_config()
    try:
        with database.engine.connect() as connection:
            postgres = connection.dialect.name == "postgresql"
            if postgres:
                connection.execute(
                    text("SELECT pg_advisory_lock(:key)"), {"key": MIGRATION_LOCK}
                )
                connection.commit()
            try:
                config.attributes["connection"] = connection
                command.upgrade(config, "head")
                command.check(config)
            finally:
                connection.rollback()
                if postgres:
                    connection.execute(
                        text("SELECT pg_advisory_unlock(:key)"), {"key": MIGRATION_LOCK}
                    )
                    connection.commit()
    finally:
        database.dispose()


if __name__ == "__main__":
    migrate()
