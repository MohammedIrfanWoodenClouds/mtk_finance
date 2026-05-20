from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.constants import (
    STATUS_FINALIZED,
    STATUS_POSTED,
    TRANSACTION_TRANSFER,
)
from app.ledger.engine import LedgerEngine, LedgerError
from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionCorrection
from app.services.account_service import get_account


def _resolve_category_ledger_account(
    db: Session, user_id: UUID, category_id: UUID | None
) -> UUID | None:
    if not category_id:
        return None
    category = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == user_id)
        .first()
    )
    if not category or not category.ledger_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid category",
        )
    if category.type != "expense":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transfer fee must use an expense category",
        )
    return category.ledger_account_id


def create_transaction(
    db: Session, user_id: UUID, data: TransactionCreate
) -> Transaction:
    account = get_account(db, user_id, data.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if data.counter_account_id:
        counter = get_account(db, user_id, data.counter_account_id)
        if not counter:
            raise HTTPException(status_code=404, detail="Counter account not found")
        if data.account_id == data.counter_account_id:
            raise HTTPException(
                status_code=400, detail="Cannot transfer to the same account"
            )

    transfer_fee = Decimal("0")
    fee_ledger_account_id: UUID | None = None
    ledger_category_id: UUID | None = None

    if data.transaction_type == TRANSACTION_TRANSFER:
        transfer_fee = data.transfer_fee or Decimal("0")
        if transfer_fee > 0:
            fee_ledger_account_id = _resolve_category_ledger_account(
                db, user_id, data.category_id
            )
    elif data.category_id:
        ledger_category_id = _resolve_category_ledger_account(
            db, user_id, data.category_id
        )

    tx = Transaction(
        user_id=user_id,
        transaction_type=data.transaction_type,
        account_id=data.account_id,
        category_id=data.category_id if data.transaction_type != TRANSACTION_TRANSFER else None,
        counter_account_id=data.counter_account_id,
        amount=data.amount,
        transfer_fee=transfer_fee,
        transaction_date=data.transaction_date,
        notes=data.notes,
        status="draft",
    )
    db.add(tx)
    db.flush()

    ledger = LedgerEngine(db, user_id)
    try:
        if ledger_category_id:
            original_category = tx.category_id
            tx.category_id = ledger_category_id
            ledger.create_journal_for_transaction(tx)
            tx.category_id = original_category
        else:
            ledger.create_journal_for_transaction(
                tx, fee_ledger_account_id=fee_ledger_account_id
            )
    except LedgerError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e

    return tx


def list_transactions(
    db: Session,
    user_id: UUID,
    page: int = 1,
    page_size: int = 20,
    account_id: UUID | None = None,
    category_id: UUID | None = None,
    date_from=None,
    date_to=None,
    transaction_type: str | None = None,
) -> tuple[list[Transaction], int]:
    q = db.query(Transaction).filter(Transaction.user_id == user_id)
    if account_id:
        q = q.filter(
            (Transaction.account_id == account_id)
            | (Transaction.counter_account_id == account_id)
        )
    if category_id:
        q = q.filter(Transaction.category_id == category_id)
    if date_from:
        q = q.filter(Transaction.transaction_date >= date_from)
    if date_to:
        q = q.filter(Transaction.transaction_date <= date_to)
    if transaction_type:
        q = q.filter(Transaction.transaction_type == transaction_type)

    total = q.count()
    items = (
        q.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def finalize_transaction(db: Session, user_id: UUID, tx_id: UUID) -> Transaction:
    tx = (
        db.query(Transaction)
        .filter(Transaction.id == tx_id, Transaction.user_id == user_id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.status == STATUS_FINALIZED:
        raise HTTPException(status_code=409, detail="Already finalized")
    if tx.status != STATUS_POSTED:
        raise HTTPException(status_code=400, detail="Only posted transactions can be finalized")
    tx.status = STATUS_FINALIZED
    tx.finalized_at = datetime.now(UTC)
    return tx


def create_correction(
    db: Session,
    user_id: UUID,
    original_id: UUID,
    data: TransactionCorrection,
) -> Transaction:
    original = (
        db.query(Transaction)
        .filter(Transaction.id == original_id, Transaction.user_id == user_id)
        .first()
    )
    if not original:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if original.status != STATUS_FINALIZED:
        raise HTTPException(
            status_code=409,
            detail="Only finalized transactions require correction entries",
        )

    reversal_amount = original.amount
    correction = TransactionCreate(
        transaction_type="adjustment",
        account_id=original.account_id,
        amount=reversal_amount,
        transaction_date=data.transaction_date or original.transaction_date,
        notes=f"Correction: {data.reason}. {data.notes or ''}".strip(),
    )
    rev = create_transaction(db, user_id, correction)
    rev.corrects_transaction_id = original.id

    if data.amount and data.amount != original.amount:
        new_tx = TransactionCreate(
            transaction_type=original.transaction_type,
            account_id=original.account_id,
            category_id=original.category_id,
            counter_account_id=original.counter_account_id,
            amount=data.amount,
            transfer_fee=original.transfer_fee,
            transaction_date=data.transaction_date or original.transaction_date,
            notes=data.notes or original.notes,
        )
        create_transaction(db, user_id, new_tx)

    return rev
