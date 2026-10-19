import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from pwdlib import PasswordHash

from app.core.config import Settings
from app.modules.auth.models import User, UserRole

MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_LENGTH = 128


class PasswordManager:
    def __init__(self) -> None:
        self._password_hash = PasswordHash.recommended()

    def hash(self, password: str) -> str:
        validate_password(password)
        return self._password_hash.hash(password)

    def verify(self, password: str, password_hash: str) -> bool:
        try:
            return self._password_hash.verify(password, password_hash)
        except (TypeError, ValueError):
            return False


def validate_password(password: str) -> None:
    if not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
        raise ValueError(
            f"Password must contain between {MIN_PASSWORD_LENGTH} "
            f"and {MAX_PASSWORD_LENGTH} characters"
        )


@dataclass(frozen=True)
class AccessTokenClaims:
    user_id: UUID
    role: UserRole
    auth_version: int
    expires_at: datetime


class AccessTokenError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class TokenService:
    def __init__(self, settings: Settings) -> None:
        self._secret = settings.auth_secret_key.get_secret_value()
        self._access_minutes = settings.auth_access_token_minutes
        self._refresh_days = settings.auth_refresh_token_days
        self._issuer = settings.auth_issuer
        self._audience = settings.auth_audience

    @property
    def access_token_seconds(self) -> int:
        return self._access_minutes * 60

    def create_access_token(
        self,
        user: User,
        *,
        now: datetime | None = None,
    ) -> str:
        issued_at = now or datetime.now(UTC)
        expires_at = issued_at + timedelta(minutes=self._access_minutes)
        payload = {
            "sub": str(user.id),
            "role": user.role.value,
            "type": "access",
            "auth_version": user.auth_version,
            "jti": str(uuid4()),
            "iat": issued_at,
            "exp": expires_at,
            "iss": self._issuer,
            "aud": self._audience,
        }
        return jwt.encode(payload, self._secret, algorithm="HS256")

    def decode_access_token(self, token: str) -> AccessTokenClaims:
        try:
            payload = jwt.decode(
                token,
                self._secret,
                algorithms=["HS256"],
                issuer=self._issuer,
                audience=self._audience,
                options={
                    "require": [
                        "sub",
                        "role",
                        "type",
                        "auth_version",
                        "jti",
                        "iat",
                        "exp",
                        "iss",
                        "aud",
                    ]
                },
            )
        except ExpiredSignatureError as exc:
            raise AccessTokenError("access_token_expired") from exc
        except InvalidTokenError as exc:
            raise AccessTokenError("invalid_access_token") from exc

        try:
            if payload["type"] != "access":
                raise ValueError("Unexpected token type")
            return AccessTokenClaims(
                user_id=UUID(payload["sub"]),
                role=UserRole(payload["role"]),
                auth_version=int(payload["auth_version"]),
                expires_at=datetime.fromtimestamp(payload["exp"], tz=UTC),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise AccessTokenError("invalid_access_token") from exc

    def new_refresh_token(self) -> tuple[str, str, datetime]:
        raw_token = secrets.token_urlsafe(48)
        expires_at = datetime.now(UTC) + timedelta(days=self._refresh_days)
        return raw_token, self.hash_refresh_token(raw_token), expires_at

    @staticmethod
    def hash_refresh_token(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_temporary_password() -> str:
    return secrets.token_urlsafe(18)
