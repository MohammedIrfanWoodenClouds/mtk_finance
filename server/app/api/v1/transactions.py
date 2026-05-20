from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.transaction import (
    TransactionCorrection,
    TransactionCreate,
    TransactionListResponse,
    TransactionResponse,
)
from app.services import transaction_service

router = APIRouter()


@router.get("", response_model=TransactionListResponse)
def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    account_id: UUID | None = None,
    category_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    transaction_type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = transaction_service.list_transactions(
        db,
        user.id,
        page=page,
        page_size=page_size,
        account_id=account_id,
        category_id=category_id,
        date_from=date_from,
        date_to=date_to,
        transaction_type=transaction_type,
    )
    return TransactionListResponse(
        items=items, total=total, page=page, page_size=page_size
    )


@router.post("", response_model=TransactionResponse, status_code=201)
def create_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tx = transaction_service.create_transaction(db, user.id, data)
    db.commit()
    db.refresh(tx)
    return tx


@router.post("/{transaction_id}/finalize", response_model=TransactionResponse)
def finalize_transaction(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tx = transaction_service.finalize_transaction(db, user.id, transaction_id)
    db.commit()
    db.refresh(tx)
    return tx


@router.post("/{transaction_id}/correct", response_model=TransactionResponse)
def correct_transaction(
    transaction_id: UUID,
    data: TransactionCorrection,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tx = transaction_service.create_correction(db, user.id, transaction_id, data)
    db.commit()
    db.refresh(tx)
    return tx
