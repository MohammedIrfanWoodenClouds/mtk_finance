from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.ledger.engine import LedgerEngine
from app.models.account import Account
from app.schemas.account import AccountCreate, AccountUpdate


def create_account(
    db: Session, user_id: UUID, data: AccountCreate
) -> Account:
    account = Account(
        user_id=user_id,
        name=data.name,
        account_type=data.account_type,
        opening_balance=data.opening_balance,
        current_balance=Decimal("0"),
        institution_name=data.institution_name,
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

    return account


def update_account(
    db: Session, account: Account, data: AccountUpdate
) -> Account:
    if data.name is not None:
        account.name = data.name
    if data.institution_name is not None:
        account.institution_name = data.institution_name
    if data.color is not None:
        account.color = data.color
    if data.icon is not None:
        account.icon = data.icon
    if data.is_active is not None:
        account.is_active = data.is_active
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
