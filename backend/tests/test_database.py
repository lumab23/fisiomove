from pathlib import Path

import pytest
from sqlalchemy import inspect, text

from app.db.session import Database


def sqlite_url(path: Path) -> str:
    return f"sqlite+pysqlite:///{path}"


def test_session_commits_and_rolls_back(tmp_path: Path) -> None:
    database = Database(sqlite_url(tmp_path / "transactions.db"))
    try:
        with database.session() as session:
            session.execute(text("CREATE TABLE marker (value INTEGER NOT NULL)"))
            session.execute(text("INSERT INTO marker (value) VALUES (1)"))

        with database.session() as session:
            assert session.scalar(text("SELECT value FROM marker")) == 1

        with pytest.raises(RuntimeError, match="force rollback"):
            with database.session() as session:
                session.execute(text("INSERT INTO marker (value) VALUES (2)"))
                raise RuntimeError("force rollback")

        with database.session() as session:
            assert session.scalar(text("SELECT COUNT(*) FROM marker")) == 1
    finally:
        database.dispose()


def test_each_test_database_is_isolated(tmp_path: Path) -> None:
    first = Database(sqlite_url(tmp_path / "first.db"))
    second = Database(sqlite_url(tmp_path / "second.db"))
    try:
        with first.session() as session:
            session.execute(text("CREATE TABLE only_in_first (id INTEGER)"))

        assert inspect(first.engine).has_table("only_in_first")
        assert not inspect(second.engine).has_table("only_in_first")
    finally:
        first.dispose()
        second.dispose()


def test_postgresql_driver_is_configured_without_connecting() -> None:
    database = Database("postgresql+psycopg://user:password@localhost:5432/fisiomove")
    try:
        assert database.engine.dialect.name == "postgresql"
        assert database.engine.dialect.driver == "psycopg"
    finally:
        database.dispose()
