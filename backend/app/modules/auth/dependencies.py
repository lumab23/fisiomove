from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.db.session import get_db_session
from app.modules.auth.models import User, UserRole
from app.modules.auth.repositories import SqlAlchemyUserRepository
from app.modules.auth.security import AccessTokenError, TokenService

bearer_scheme = HTTPBearer(auto_error=False)


def get_authenticated_user(
    request: Request,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    session: Annotated[Session, Depends(get_db_session)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        _raise_authentication_error("authentication_required")

    token_service = TokenService(request.app.state.settings)
    try:
        claims = token_service.decode_access_token(credentials.credentials)
    except AccessTokenError as exc:
        _raise_authentication_error(exc.code)

    user = SqlAlchemyUserRepository(session).get_by_id(claims.user_id)
    if user is None:
        _raise_authentication_error("invalid_access_token")
    if not user.is_active:
        raise ApiError(
            status_code=403,
            code="account_inactive",
            message="This account is inactive.",
        )
    if user.auth_version != claims.auth_version or user.role is not claims.role:
        _raise_authentication_error("access_token_invalidated")
    return user


def get_current_user(
    user: Annotated[User, Depends(get_authenticated_user)],
) -> User:
    """Identity dependency for business routes after first-password change."""
    if user.must_change_password:
        raise ApiError(
            status_code=403,
            code="password_change_required",
            message="Change the temporary password before accessing this resource.",
        )
    return user


def require_role(*allowed_roles: UserRole) -> Callable[..., User]:
    def dependency(
        user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if user.role not in allowed_roles:
            raise ApiError(
                status_code=403,
                code="insufficient_role",
                message="The authenticated account cannot access this resource.",
            )
        return user

    return dependency


def _raise_authentication_error(code: str) -> None:
    messages = {
        "authentication_required": "Authentication is required.",
        "access_token_expired": "The access token expired.",
        "invalid_access_token": "The access token is invalid.",
        "access_token_invalidated": "The access token is no longer valid.",
    }
    raise ApiError(
        status_code=401,
        code=code,
        message=messages[code],
        headers={"WWW-Authenticate": "Bearer"},
    )
