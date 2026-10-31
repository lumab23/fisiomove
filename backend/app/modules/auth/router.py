from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.modules.auth.dependencies import get_authenticated_user
from app.modules.auth.models import User
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    TokenPairResponse,
    UserResponse,
)
from app.modules.auth.services import AuthenticationService, IssuedTokenPair

router = APIRouter(prefix="/auth", tags=["authentication"])


def service(request: Request, session: Session) -> AuthenticationService:
    return AuthenticationService(session, request.app.state.settings)


def token_response(pair: IssuedTokenPair) -> TokenPairResponse:
    return TokenPairResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        expires_in=pair.expires_in,
    )


@router.post("/login", response_model=TokenPairResponse)
def login(
    payload: LoginRequest,
    request: Request,
    session: Annotated[Session, Depends(get_db_session, scope="function")],
) -> TokenPairResponse:
    pair = service(request, session).login(
        str(payload.email),
        payload.password.get_secret_value(),
    )
    return token_response(pair)


@router.post("/refresh", response_model=TokenPairResponse)
def refresh(
    payload: RefreshRequest,
    request: Request,
    session: Annotated[Session, Depends(get_db_session, scope="function")],
) -> TokenPairResponse:
    pair = service(request, session).refresh(payload.refresh_token.get_secret_value())
    return token_response(pair)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: LogoutRequest,
    request: Request,
    session: Annotated[Session, Depends(get_db_session, scope="function")],
) -> Response:
    service(request, session).logout(payload.refresh_token.get_secret_value())
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserResponse)
def me(
    user: Annotated[User, Depends(get_authenticated_user)],
) -> User:
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    user: Annotated[User, Depends(get_authenticated_user)],
    session: Annotated[Session, Depends(get_db_session, scope="function")],
) -> Response:
    service(request, session).change_password(
        user,
        payload.current_password.get_secret_value(),
        payload.new_password.get_secret_value(),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
