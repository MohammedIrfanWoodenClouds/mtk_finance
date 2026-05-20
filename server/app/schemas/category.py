from uuid import UUID

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: str = Field(description="income, expense, investment")
    parent_id: UUID | None = None
    color: str | None = None
    icon: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    icon: str | None = None
    is_active: bool | None = None


class CategoryResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    type: str
    parent_id: UUID | None
    color: str | None
    icon: str | None
    is_system: bool
    is_active: bool

    model_config = {"from_attributes": True}
