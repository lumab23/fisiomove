from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr

from app.modules.auth.models import UserRole

Password = Annotated[SecretStr, Field(min_length=12, max_length=128)]
RefreshTokenValue = Annotated[SecretStr, Field(min_length=32, max_length=512)]


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginRequest(StrictRequest):
    email: EmailStr
    password: Password


class RefreshRequest(StrictRequest):
    refresh_token: RefreshTokenValue


class LogoutRequest(StrictRequest):
    refresh_token: RefreshTokenValue


class ChangePasswordRequest(StrictRequest):
    current_password: Password
    new_password: Password


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    role: UserRole
    is_active: bool
    must_change_password: bool
    created_at: datetime
    updated_at: datetime
