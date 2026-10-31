"""Disposable PostgreSQL databases; never modify the administrative database."""

from collections.abc import Iterator
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url


def disposable_postgres(configured: str) -> Iterator[str]:
    url = make_url(configured)
    if url.drivername != "postgresql+psycopg":
        raise ValueError("FISIOMOVE_TEST_POSTGRES_URL must use postgresql+psycopg")
    database_name = f"fisiomove_test_{uuid4().hex}"
    engine = create_engine(
        url,
        isolation_level="AUTOCOMMIT",
        hide_parameters=True,
        connect_args={"connect_timeout": 10},
    )
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql(f'CREATE DATABASE "{database_name}"')
        try:
            yield url.set(database=database_name).render_as_string(hide_password=False)
        finally:
            with engine.connect() as connection:
                connection.exec_driver_sql(
                    f'DROP DATABASE "{database_name}" WITH (FORCE)'
                )
    finally:
        engine.dispose()
