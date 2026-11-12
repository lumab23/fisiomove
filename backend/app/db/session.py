from collections.abc import Generator, Iterator
from contextlib import contextmanager

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings


class Database:
    """Own the SQLAlchemy engine and transactional session factory."""

    def __init__(
        self,
        database_url: str,
        *,
        echo: bool = False,
        pool_size: int = 5,
        max_overflow: int = 10,
        pool_timeout: int = 30,
        pool_recycle: int = 1800,
        connect_timeout: int = 10,
        statement_timeout_ms: int = 30000,
        lock_timeout_ms: int = 10000,
    ) -> None:
        postgres = make_url(database_url).get_backend_name() == "postgresql"
        if postgres:
            self.engine: Engine = create_engine(
                database_url,
                echo=echo,
                hide_parameters=True,
                pool_pre_ping=True,
                pool_use_lifo=True,
                pool_size=pool_size,
                max_overflow=max_overflow,
                pool_timeout=pool_timeout,
                pool_recycle=pool_recycle,
                connect_args={
                    "connect_timeout": connect_timeout,
                    "application_name": "fisiomove-api",
                    "options": (
                        f"-c timezone=UTC -c statement_timeout={statement_timeout_ms} "
                        f"-c lock_timeout={lock_timeout_ms}"
                    ),
                },
            )
        else:
            self.engine = create_engine(
                database_url,
                echo=echo,
                hide_parameters=True,
                pool_pre_ping=True,
                connect_args={"check_same_thread": False},
            )
        self._session_factory = sessionmaker(
            bind=self.engine,
            autoflush=False,
            expire_on_commit=False,
        )

    @classmethod
    def from_settings(cls, settings: Settings) -> "Database":
        return cls(
            settings.database_url,
            echo=settings.db_echo,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_timeout=settings.db_pool_timeout_seconds,
            pool_recycle=settings.db_pool_recycle_seconds,
            connect_timeout=settings.db_connect_timeout_seconds,
            statement_timeout_ms=settings.db_statement_timeout_ms,
            lock_timeout_ms=settings.db_lock_timeout_ms,
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
