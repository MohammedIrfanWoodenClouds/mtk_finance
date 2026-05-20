from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.account import (
    AccountCreate,
    AccountResponse,
    AccountSummaryResponse,
    AccountUpdate,
)
from app.services import account_service
from app.services.balance_service import list_user_accounts, summarize_accounts

router = APIRouter()


@router.get("/summary", response_model=AccountSummaryResponse)
def accounts_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    accounts = list_user_accounts(db, user.id)
    totals = summarize_accounts(accounts)
    return AccountSummaryResponse(**totals)


@router.get("", response_model=list[AccountResponse])
def list_accounts(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return account_service.list_accounts(db, user.id, include_inactive)


@router.post("", response_model=AccountResponse, status_code=201)
def create_account(
    data: AccountCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    account = account_service.create_account(db, user.id, data)
    db.commit()
    db.refresh(account)
    return account


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    account = account_service.get_account(db, user.id, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.patch("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: UUID,
    data: AccountUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    account = account_service.get_account(db, user.id, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.is_system:
        raise HTTPException(status_code=403, detail="Cannot modify system account")
    account = account_service.update_account(db, user.id, account, data)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
def delete_account(
    account_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    account = account_service.get_account(db, user.id, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    account_service.delete_account(db, user.id, account)
    db.commit()
