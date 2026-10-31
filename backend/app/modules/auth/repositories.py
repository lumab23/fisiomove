from collections.abc import Sequence
from datetime import datetime
from typing import Protocol
from uuid import UUID

from sqlalchemy import Select, select, update
from sqlalchemy.orm import Session

from app.modules.auth.models import RefreshToken, User, UserRole


class UserRepository(Protocol):
    def get_by_id_for_update(self, user_id: UUID) -> User | None: ...

    def get_by_email_for_update(self, email: str) -> User | None: ...

    def get_by_id(self, user_id: UUID) -> User | None: ...

    def get_by_email(self, email: str) -> User | None: ...

    def add(self, user: User) -> User: ...

    def has_role(self, role: UserRole) -> bool: ...


class RefreshTokenRepository(Protocol):
    def get_by_hash(self, token_hash: str) -> RefreshToken | None: ...

    def get_by_hash_for_update(self, token_hash: str) -> RefreshToken | None: ...

    def add(self, token: RefreshToken) -> RefreshToken: ...

    def revoke_active_for_user(self, user_id: UUID, revoked_at: datetime) -> None: ...


class SqlAlchemyUserRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_id(self, user_id: UUID) -> User | None:
        return self._session.get(User, user_id)

    def get_by_id_for_update(self, user_id: UUID) -> User | None:
        return self._session.scalar(
            select(User)
            .where(User.id == user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def get_by_email_for_update(self, email: str) -> User | None:
        return self._session.scalar(
            select(User)
            .where(User.email == email)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def get_by_email(self, email: str) -> User | None:
        return self._session.scalar(select(User).where(User.email == email))

    def add(self, user: User) -> User:
        self._session.add(user)
        self._session.flush()
        return user

    def has_role(self, role: UserRole) -> bool:
        statement: Select[tuple[User]] = select(User).where(User.role == role).limit(1)
        return self._session.scalar(statement) is not None


class SqlAlchemyRefreshTokenRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        return self._session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )

    def get_by_hash_for_update(self, token_hash: str) -> RefreshToken | None:
        statement = (
            select(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        return self._session.scalar(statement)

    def add(self, token: RefreshToken) -> RefreshToken:
        self._session.add(token)
        self._session.flush()
        return token

    def revoke_active_for_user(self, user_id: UUID, revoked_at: datetime) -> None:
        self._session.execute(
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=revoked_at)
        )

    def list_for_user(self, user_id: UUID) -> Sequence[RefreshToken]:
        return self._session.scalars(
            select(RefreshToken).where(RefreshToken.user_id == user_id)
        ).all()
