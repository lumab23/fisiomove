from datetime import datetime
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


Name = Annotated[str, Field(min_length=2, max_length=200)]
Phone = Annotated[str, Field(min_length=3, max_length=32)]


def _strip_required(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _strip_optional(value: object) -> object:
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip() or None
    return value


class PatientCreate(StrictRequest):
    full_name: Name
    email: EmailStr | None = None
    phone: Phone | None = None

    _normalize_name = field_validator("full_name", mode="before")(_strip_required)
    _normalize_phone = field_validator("phone", mode="before")(_strip_optional)


class PatientUpdate(StrictRequest):
    full_name: Name | None = None
    email: EmailStr | None = None
    phone: Phone | None = None
    is_active: bool | None = None

    _normalize_name = field_validator("full_name", mode="before")(_strip_optional)
    _normalize_phone = field_validator("phone", mode="before")(_strip_optional)

    @model_validator(mode="after")
    def validate_patch(self) -> "PatientUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        if "full_name" in self.model_fields_set and self.full_name is None:
            raise ValueError("full_name cannot be null")
        if "is_active" in self.model_fields_set and self.is_active is None:
            raise ValueError("is_active cannot be null")
        return self


class PatientResponse(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr | None
    phone: str | None
    is_active: bool
    has_access: bool
    access_is_active: bool
    must_change_password: bool
    created_at: datetime
    updated_at: datetime


class PatientPage(BaseModel):
    items: list[PatientResponse]
    page: int
    page_size: int
    total: int
    pages: int


class PatientAccessOperation(StrEnum):
    ACTIVATE = "activate"
    RESET_TEMPORARY_PASSWORD = "reset_temporary_password"


class PatientAccessRequest(StrictRequest):
    operation: PatientAccessOperation = PatientAccessOperation.ACTIVATE


class PatientAccessResponse(BaseModel):
    patient_id: UUID
    user_id: UUID
    email: EmailStr
    temporary_password: str
    must_change_password: bool = True
    action: str
