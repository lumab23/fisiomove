from collections.abc import Generator, Iterator
from contextlib import contextmanager

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker


class Database:
    """Own the SQLAlchemy engine and transactional session factory."""

    def __init__(self, database_url: str, *, echo: bool = False) -> None:
        connect_args = (
            {"check_same_thread": False}
            if database_url.startswith("sqlite+pysqlite://")
            else {}
        )
        self.engine: Engine = create_engine(
            database_url,
            echo=echo,
            pool_pre_ping=True,
            connect_args=connect_args,
        )
        self._session_factory = sessionmaker(
            bind=self.engine,
            autoflush=False,
            expire_on_commit=False,
        )

    @contextmanager
    def session(self) -> Iterator[Session]:
        session = self._session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def dispose(self) -> None:
        self.engine.dispose()


def get_db_session(request: Request) -> Generator[Session, None, None]:
    """FastAPI dependency that provides one transaction per request."""
    database: Database = request.app.state.database
    with database.session() as session:
        yield session
