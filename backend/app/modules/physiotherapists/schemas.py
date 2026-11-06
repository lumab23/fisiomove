from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

Name = Annotated[str, Field(min_length=2, max_length=200)]


def _strip(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


class PhysiotherapistProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: Name

    _normalize_name = field_validator("full_name", mode="before")(_strip)


class PhysiotherapistProfileResponse(BaseModel):
    """Own profile; `full_name` is null until the professional defines it."""

    full_name: str | None


class LinkedPhysiotherapistResponse(BaseModel):
    """What a patient may see about the linked professional: only the name."""

    full_name: str | None
