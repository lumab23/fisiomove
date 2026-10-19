from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def test_empty_database_migrates_to_head(tmp_path: Path) -> None:
    database_path = tmp_path / "migration.db"
    database_url = f"sqlite+pysqlite:///{database_path}"
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)

    command.upgrade(config, "head")

    engine = create_engine(database_url)
    try:
        assert inspect(engine).get_table_names() == ["alembic_version"]
        with engine.connect() as connection:
            revision = connection.scalar(
                text("SELECT version_num FROM alembic_version")
            )
        assert revision == "20261019_0001"
    finally:
        engine.dispose()
