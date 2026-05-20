from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    account_type: str = Field(
        description="bank, cash, investment, credit_card, loan, equity"
    )
    opening_balance: Decimal = Field(default=Decimal("0"))
    institution_name: str | None = None
    color: str | None = None
    icon: str | None = None


class AccountUpdate(BaseModel):
    name: str | None = None
    institution_name: str | None = None
    color: str | None = None
    icon: str | None = None
    is_active: bool | None = None


class AccountResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    account_type: str
    opening_balance: Decimal
    current_balance: Decimal
    institution_name: str | None
    color: str | None
    icon: str | None
    is_active: bool
    is_system: bool
    created_at: datetime

    model_config = {"from_attributes": True}
