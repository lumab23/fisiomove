from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class Side(StrEnum):
    LEFT = "left"
    RIGHT = "right"
    BILATERAL = "bilateral"


class ExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str
    instructions: str
    allowed_sides: list[Side]
    rule_version: str
    supported_parameters: dict[str, Any]
    is_active: bool
    approval_status: Literal["pending", "approved", "revoked"]
    approved_rule_version: str | None


class ExercisePage(BaseModel):
    items: list[ExerciseResponse]
    page: int
    page_size: int
    total: int
    pages: int
