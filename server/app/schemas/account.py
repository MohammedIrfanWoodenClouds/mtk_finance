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
            "Credit card: signed balance (+ used limit, − credit on card). "
            "Other liabilities: amount owed (+ owed, − credit)."
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


class CreditCardMetricsResponse(BaseModel):
    """Derived credit-card fields (issuer-style; not stored separately)."""

    used_limit: Decimal = Field(ge=0, description="Portion of line in use")
    credit_on_card: Decimal = Field(ge=0, description="Overpayment on card")
    available: Decimal | None = Field(
        default=None,
        description="Limit − used limit; null if no limit set",
    )
    over_limit: Decimal = Field(ge=0, description="Used limit above credit line")
    utilization_pct: int | None = Field(
        default=None, ge=0, le=100, description="Used / limit × 100"
    )
    signed_balance: Decimal = Field(
        description="Ledger balance (+ used, − credit on card)"
    )


class AccountUpdate(BaseModel):
    name: str | None = None
    institution_name: str | None = None
    credit_limit: Decimal | None = None
    current_outstanding: Decimal | None = Field(
        default=None,
        description=(
            "Signed ledger balance. Credit cards: positive = used limit, "
            "negative = credit on card."
        ),
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
    credit_card: CreditCardMetricsResponse | None = None
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
    total_over_limit: Decimal = Decimal("0")
    portfolio_utilization_pct: int | None = None
    has_credit_limits: bool = False
