from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.constants import validate_user_account_type
from app.ledger.engine import LedgerEngine, LedgerError
from app.models.account import Account
from app.models.category import Category
from app.schemas.account import AccountCreate, AccountUpdate
def create_account(
    db: Session, user_id: UUID, data: AccountCreate
) -> Account:
    try:
        validate_user_account_type(data.account_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if data.account_type != "credit_card" and data.credit_limit is not None:
        raise HTTPException(
            status_code=400,
            detail="Credit limit applies only to credit_card accounts",
        )

    account = Account(
        user_id=user_id,
        name=data.name,
        account_type=data.account_type,
        opening_balance=data.opening_balance,
        current_balance=Decimal("0"),
        institution_name=data.institution_name,
        credit_limit=data.credit_limit if data.account_type == "credit_card" else None,
        color=data.color,
        icon=data.icon,
        is_active=True,
        is_system=False,
    )
    db.add(account)
    db.flush()

    ledger = LedgerEngine(db, user_id)
    ledger.post_opening_balance(account)
    account.current_balance = data.opening_balance
    account.opening_balance = data.opening_balance

    return account


def update_account(
    db: Session, user_id: UUID, account: Account, data: AccountUpdate
) -> Account:
    if data.name is not None:
        account.name = data.name.strip()
    if data.institution_name is not None:
        account.institution_name = data.institution_name.strip() or None
    if data.color is not None:
        account.color = data.color
    if data.icon is not None:
        account.icon = data.icon
    if data.is_active is not None:
        account.is_active = data.is_active
    if data.credit_limit is not None:
        if account.account_type != "credit_card":
            raise HTTPException(
                status_code=400,
                detail="Credit limit applies only to credit_card accounts",
            )
        account.credit_limit = data.credit_limit

    if data.current_outstanding is not None:
        ledger = LedgerEngine(db, user_id)
        try:
            ledger.post_reconcile_balance(
                account,
                data.current_outstanding,
                note=f"Updated balance for {account.name}",
            )
        except LedgerError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    return account


def list_accounts(db: Session, user_id: UUID, include_inactive: bool = False) -> list[Account]:
    q = db.query(Account).filter(Account.user_id == user_id)
    if not include_inactive:
        q = q.filter(Account.is_active.is_(True))
    return q.order_by(Account.name).all()


def get_account(db: Session, user_id: UUID, account_id: UUID) -> Account | None:
    return (
        db.query(Account)
        .filter(Account.id == account_id, Account.user_id == user_id)
        .first()
    )


def _assert_account_deletable(account: Account) -> None:
    if account.is_system:
        raise HTTPException(status_code=403, detail="Cannot delete system account")
    if account.account_type.startswith("category_"):
        raise HTTPException(
            status_code=403,
            detail="Cannot delete category ledger account",
        )


def delete_account(db: Session, user_id: UUID, account: Account) -> None:
    """Deactivate account (soft delete). Transaction history is preserved."""
    _assert_account_deletable(account)

    category_ref = (
        db.query(Category)
        .filter(
            Category.user_id == user_id,
            Category.ledger_account_id == account.id,
            Category.is_active.is_(True),
        )
        .first()
    )
    if category_ref:
        raise HTTPException(
            status_code=409,
            detail=f'Account is linked to category "{category_ref.name}". '
            "Deactivate or delete that category first.",
        )

    if not account.is_active:
        raise HTTPException(status_code=409, detail="Account is already deleted")

    account.is_active = False
