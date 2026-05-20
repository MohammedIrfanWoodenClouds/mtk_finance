from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    transaction_type: str = Field(
        description="income, expense, transfer, adjustment"
    )
    account_id: UUID
    category_id: UUID | None = None
    counter_account_id: UUID | None = None
    amount: Decimal = Field(gt=0)
    transaction_date: date
    notes: str | None = None


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
