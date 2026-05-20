from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.constants import ALL_USER_ACCOUNT_TYPES, validate_user_account_type


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    account_type: str = Field(
        description="bank, cash, investment, credit_card, loan, loan_personal"
    )
    opening_balance: Decimal = Field(
        default=Decimal("0"),
        description=(
            "Assets: balance (negative = overdraft). "
            "Liabilities: owed (negative = credit/overpayment on card)."
        ),
    )
    institution_name: str | None = Field(
        default=None,
        description="Bank name, card issuer, or lender (e.g. friend name)",
    )
    credit_limit: Decimal | None = Field(
        default=None,
        description="Credit card limit only (not your balance)",
    )
    color: str | None = None
    icon: str | None = None

    @field_validator("account_type")
    @classmethod
    def check_account_type(cls, v: str) -> str:
        validate_user_account_type(v.strip())
        return v.strip()

    @field_validator("credit_limit")
    @classmethod
    def credit_limit_positive(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("Credit limit must be positive")
        return v


class AccountUpdate(BaseModel):
    name: str | None = None
    institution_name: str | None = None
    credit_limit: Decimal | None = None
    current_outstanding: Decimal | None = Field(
        default=None,
        description="Account balance; negative allowed (overdraft / card credit)",
    )
    color: str | None = None
    icon: str | None = None
    is_active: bool | None = None

    @field_validator("credit_limit")
    @classmethod
    def credit_limit_positive(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("Credit limit must be positive")
        return v


class AccountResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    account_type: str
    opening_balance: Decimal
    current_balance: Decimal
    institution_name: str | None
    credit_limit: Decimal | None
    color: str | None
    icon: str | None
    is_active: bool
    is_system: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AccountSummaryResponse(BaseModel):
    total_assets: Decimal
    total_liabilities: Decimal
    net_worth: Decimal
    total_credit_limit: Decimal = Decimal("0")
    total_credit_outstanding: Decimal = Decimal("0")
    total_credit_on_cards: Decimal = Decimal("0")
    available_credit: Decimal = Decimal("0")
    has_credit_limits: bool = False
