from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.constants import is_asset_account, is_liability_account
from app.models.account import Account


def is_user_visible_account(account: Account) -> bool:
    return not account.is_system and not account.account_type.startswith(
        "category_"
    )


def summarize_accounts(accounts: list[Account]) -> dict[str, Decimal]:
    assets = Decimal("0")
    liabilities = Decimal("0")
    for acc in accounts:
        if not is_user_visible_account(acc):
            continue
        bal = acc.current_balance or Decimal("0")
        if is_asset_account(acc.account_type):
            assets += bal
        elif is_liability_account(acc.account_type):
            liabilities += bal
    return {
        "total_assets": assets,
        "total_liabilities": liabilities,
        "net_worth": assets - liabilities,
    }


def list_user_accounts(db: Session, user_id: UUID) -> list[Account]:
    return (
        db.query(Account)
        .filter(
            Account.user_id == user_id,
            Account.is_active.is_(True),
            Account.is_system.is_(False),
            Account.account_type.notlike("category_%"),
        )
        .order_by(Account.name)
        .all()
    )
