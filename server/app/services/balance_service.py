from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.constants import is_asset_account, is_liability_account
from app.models.account import Account
from app.services.credit_card_math import amount_owed, available_credit, credit_balance


def is_user_visible_account(account: Account) -> bool:
    return not account.is_system and not account.account_type.startswith(
        "category_"
    )


def _credit_card_stats(accounts: list[Account]) -> dict[str, Decimal]:
    total_limit = Decimal("0")
    total_outstanding = Decimal("0")
    total_credit_on_cards = Decimal("0")
    has_limit = False
    available = Decimal("0")
    for acc in accounts:
        if not is_user_visible_account(acc) or acc.account_type != "credit_card":
            continue
        bal = acc.current_balance or Decimal("0")
        total_outstanding += amount_owed(bal)
        total_credit_on_cards += credit_balance(bal)
        lim = acc.credit_limit
        if lim is not None and lim > 0:
            total_limit += lim
            has_limit = True
            available += available_credit(lim, bal)
    return {
        "total_credit_limit": total_limit if has_limit else Decimal("0"),
        "total_credit_outstanding": total_outstanding,
        "total_credit_on_cards": total_credit_on_cards,
        "available_credit": available,
        "has_credit_limits": has_limit,
    }


def summarize_accounts(accounts: list[Account]) -> dict[str, Decimal | bool]:
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

    cc = _credit_card_stats(accounts)
    return {
        "total_assets": assets,
        "total_liabilities": liabilities,
        "net_worth": assets - liabilities,
        **cc,
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
