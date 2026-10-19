from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4

from pydantic import EmailStr, TypeAdapter
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError
from app.modules.auth.models import RefreshToken, User, UserRole, utc_now
from app.modules.auth.repositories import (
    SqlAlchemyRefreshTokenRepository,
    SqlAlchemyUserRepository,
)
from app.modules.auth.security import (
    PasswordManager,
    TokenService,
    generate_temporary_password,
    validate_password,
)

EMAIL_ADAPTER = TypeAdapter(EmailStr)


def normalize_email(email: str) -> str:
    return str(EMAIL_ADAPTER.validate_python(email.strip())).lower()


def ensure_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


@dataclass(frozen=True)
class IssuedTokenPair:
    access_token: str
    refresh_token: str
    expires_in: int


@dataclass(frozen=True)
class TemporaryAccessCredential:
    user_id: UUID
    email: str
    temporary_password: str


class AuthenticationService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self._session = session
        self._users = SqlAlchemyUserRepository(session)
        self._refresh_tokens = SqlAlchemyRefreshTokenRepository(session)
        self._passwords = PasswordManager()
        self._tokens = TokenService(settings)

    def login(self, email: str, password: str) -> IssuedTokenPair:
        user = self._users.get_by_email(normalize_email(email))
        if user is None or not self._passwords.verify(password, user.password_hash):
            raise ApiError(
                status_code=401,
                code="invalid_credentials",
                message="Invalid email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise ApiError(
                status_code=403,
                code="account_inactive",
                message="This account is inactive.",
            )
        return self._issue_token_pair(user)

    def refresh(self, raw_token: str) -> IssuedTokenPair:
        token_hash = self._tokens.hash_refresh_token(raw_token)
        stored_token = self._refresh_tokens.get_by_hash_for_update(token_hash)
        if stored_token is None:
            self._raise_refresh_error("invalid_refresh_token")
        if stored_token.revoked_at is not None:
            self._raise_refresh_error("refresh_token_revoked")
        if ensure_utc(stored_token.expires_at) <= datetime.now(UTC):
            self._raise_refresh_error("refresh_token_expired")

        user = self._users.get_by_id(stored_token.user_id)
        if user is None or not user.is_active:
            raise ApiError(
                status_code=403,
                code="account_inactive",
                message="This account is inactive.",
            )

        pair = self._issue_token_pair(user, family_id=stored_token.family_id)
        replacement_hash = self._tokens.hash_refresh_token(pair.refresh_token)
        replacement = self._refresh_tokens.get_by_hash_for_update(replacement_hash)
        if replacement is None:
            raise RuntimeError("Rotated refresh token was not persisted")
        stored_token.revoked_at = utc_now()
        stored_token.replaced_by_id = replacement.id
        self._session.flush()
        return pair

    def logout(self, raw_token: str) -> None:
        token_hash = self._tokens.hash_refresh_token(raw_token)
        stored_token = self._refresh_tokens.get_by_hash_for_update(token_hash)
        if stored_token is not None and stored_token.revoked_at is None:
            stored_token.revoked_at = utc_now()
            self._session.flush()

    def change_password(
        self,
        user: User,
        current_password: str,
        new_password: str,
    ) -> None:
        validate_password(new_password)
        if not self._passwords.verify(current_password, user.password_hash):
            raise ApiError(
                status_code=400,
                code="current_password_invalid",
                message="The current password is invalid.",
            )
        if self._passwords.verify(new_password, user.password_hash):
            raise ApiError(
                status_code=400,
                code="password_reuse",
                message="The new password must differ from the current password.",
            )

        user.password_hash = self._passwords.hash(new_password)
        user.must_change_password = False
        user.auth_version += 1
        user.updated_at = utc_now()
        self._refresh_tokens.revoke_active_for_user(user.id, utc_now())
        self._session.flush()

    def _issue_token_pair(
        self,
        user: User,
        *,
        family_id: UUID | None = None,
    ) -> IssuedTokenPair:
        raw_token, token_hash, expires_at = self._tokens.new_refresh_token()
        self._refresh_tokens.add(
            RefreshToken(
                user_id=user.id,
                token_hash=token_hash,
                family_id=family_id or uuid4(),
                expires_at=expires_at,
            )
        )
        return IssuedTokenPair(
            access_token=self._tokens.create_access_token(user),
            refresh_token=raw_token,
            expires_in=self._tokens.access_token_seconds,
        )

    def _raise_refresh_error(self, code: str) -> None:
        messages = {
            "invalid_refresh_token": "The refresh token is invalid.",
            "refresh_token_revoked": "The refresh token was revoked.",
            "refresh_token_expired": "The refresh token expired.",
        }
        raise ApiError(
            status_code=401,
            code=code,
            message=messages[code],
            headers={"WWW-Authenticate": "Bearer"},
        )


class AccountProvisioningService:
    """Local administrative account creation; it is not exposed as an API route."""

    def __init__(self, session: Session) -> None:
        self._users = SqlAlchemyUserRepository(session)
        self._passwords = PasswordManager()

    def create_initial_physiotherapist(
        self,
        email: str,
        temporary_password: str,
    ) -> User:
        normalized_email = normalize_email(email)
        if self._users.has_role(UserRole.PHYSIOTHERAPIST):
            raise ApiError(
                status_code=409,
                code="initial_physiotherapist_exists",
                message="The initial physiotherapist already exists.",
            )
        if self._users.get_by_email(normalized_email) is not None:
            raise ApiError(
                status_code=409,
                code="email_conflict",
                message="An account already uses this email.",
            )
        return self._users.add(
            User(
                email=normalized_email,
                password_hash=self._passwords.hash(temporary_password),
                role=UserRole.PHYSIOTHERAPIST,
                is_active=True,
                must_change_password=True,
            )
        )


class PatientAccountService:
    """Internal patient access operations for B03 to call after authorization."""

    def __init__(self, session: Session) -> None:
        self._session = session
        self._users = SqlAlchemyUserRepository(session)
        self._refresh_tokens = SqlAlchemyRefreshTokenRepository(session)
        self._passwords = PasswordManager()

    def create_access(self, email: str) -> TemporaryAccessCredential:
        normalized_email = normalize_email(email)
        if self._users.get_by_email(normalized_email) is not None:
            raise ApiError(
                status_code=409,
                code="email_conflict",
                message="An account already uses this email.",
            )
        temporary_password = generate_temporary_password()
        user = self._users.add(
            User(
                email=normalized_email,
                password_hash=self._passwords.hash(temporary_password),
                role=UserRole.PATIENT,
                is_active=True,
                must_change_password=True,
            )
        )
        return TemporaryAccessCredential(user.id, user.email, temporary_password)

    def activate_access(self, user_id: UUID) -> TemporaryAccessCredential:
        user = self._get_patient(user_id)
        user.is_active = True
        return self._set_temporary_password(user)

    def reset_temporary_password(self, user_id: UUID) -> TemporaryAccessCredential:
        user = self._get_patient(user_id)
        if not user.is_active:
            raise ApiError(
                status_code=409,
                code="account_inactive",
                message="Activate the patient account before resetting its credential.",
            )
        return self._set_temporary_password(user)

    def deactivate_access(self, user_id: UUID) -> None:
        user = self._get_patient(user_id)
        if user.is_active:
            user.is_active = False
            user.auth_version += 1
            user.updated_at = utc_now()
            self._refresh_tokens.revoke_active_for_user(user.id, utc_now())
            self._session.flush()

    def change_email(self, user_id: UUID, email: str) -> User:
        user = self._get_patient(user_id)
        normalized_email = normalize_email(email)
        existing = self._users.get_by_email(normalized_email)
        if existing is not None and existing.id != user.id:
            raise ApiError(
                status_code=409,
                code="email_conflict",
                message="An account already uses this email.",
            )
        user.email = normalized_email
        user.updated_at = utc_now()
        self._session.flush()
        return user

    def _get_patient(self, user_id: UUID) -> User:
        user = self._users.get_by_id(user_id)
        if user is None:
            raise ApiError(
                status_code=404,
                code="account_not_found",
                message="The patient account was not found.",
            )
        if user.role is not UserRole.PATIENT:
            raise ApiError(
                status_code=409,
                code="role_mismatch",
                message="The account is not a patient account.",
            )
        return user

    def _set_temporary_password(self, user: User) -> TemporaryAccessCredential:
        temporary_password = generate_temporary_password()
        user.password_hash = self._passwords.hash(temporary_password)
        user.must_change_password = True
        user.auth_version += 1
        user.updated_at = utc_now()
        self._refresh_tokens.revoke_active_for_user(user.id, utc_now())
        self._session.flush()
        return TemporaryAccessCredential(user.id, user.email, temporary_password)
