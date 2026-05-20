from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class TransactionCreate(BaseModel):
    transaction_type: str = Field(
        description="income, expense, transfer, adjustment"
    )
    account_id: UUID
    category_id: UUID | None = Field(
        default=None,
        description="Expense category for income/expense; fee category for transfers",
    )
    counter_account_id: UUID | None = None
    amount: Decimal = Field(
        gt=0,
        description="Transfer: amount received by destination (principal)",
    )
    transfer_fee: Decimal | None = Field(
        default=None,
        ge=0,
        description="Optional bank/wire/FX charge on transfer (expensed separately)",
    )
    transaction_date: date
    notes: str | None = None

    @model_validator(mode="after")
    def validate_transfer(self) -> "TransactionCreate":
        if self.transaction_type != "transfer":
            return self
        if not self.counter_account_id:
            raise ValueError("counter_account_id is required for transfers")
        if self.account_id == self.counter_account_id:
            raise ValueError("Cannot transfer to the same account")
        fee = self.transfer_fee or Decimal("0")
        if fee > 0 and not self.category_id:
            raise ValueError("category_id required when transfer_fee is set")
        return self


class TransactionCorrection(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    transaction_date: date | None = None
    notes: str | None = None
    reason: str = Field(min_length=1)


class TransactionResponse(BaseModel):
    id: UUID
    user_id: UUID
    transaction_type: str
    account_id: UUID
    category_id: UUID | None
    counter_account_id: UUID | None
    amount: Decimal
    transfer_fee: Decimal = Decimal("0")
    transaction_date: date
    notes: str | None
    status: str
    finalized_at: datetime | None
    corrects_transaction_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    page_size: int
