from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.constants import DEFAULT_CATEGORIES
from app.models.account import Account
from app.models.category import Category
from app.models.user import User


def _ledger_account_type(category_type: str) -> str:
    return f"category_{category_type}"


def create_ledger_account_for_category(
    db: Session, user_id: UUID, name: str, category_type: str
) -> Account:
    account = Account(
        user_id=user_id,
        name=name,
        account_type=_ledger_account_type(category_type),
        opening_balance=Decimal("0"),
        current_balance=Decimal("0"),
        is_system=True,
        is_active=True,
    )
    db.add(account)
    db.flush()
    return account


def seed_default_categories(db: Session, user: User) -> None:
    for name, cat_type, color in DEFAULT_CATEGORIES:
        existing = (
            db.query(Category)
            .filter(
                Category.user_id == user.id,
                Category.name == name,
                Category.is_system.is_(True),
            )
            .first()
        )
        if existing:
            continue
        ledger_account = create_ledger_account_for_category(
            db, user.id, name, cat_type
        )
        category = Category(
            user_id=user.id,
            name=name,
            type=cat_type,
            color=color,
            is_system=True,
            is_active=True,
            ledger_account_id=ledger_account.id,
        )
        db.add(category)


def create_category(
    db: Session,
    user_id: UUID,
    name: str,
    cat_type: str,
    parent_id: UUID | None = None,
    color: str | None = None,
    icon: str | None = None,
) -> Category:
    ledger_account = create_ledger_account_for_category(db, user_id, name, cat_type)
    category = Category(
        user_id=user_id,
        name=name,
        type=cat_type,
        parent_id=parent_id,
        color=color,
        icon=icon,
        is_system=False,
        is_active=True,
        ledger_account_id=ledger_account.id,
    )
    db.add(category)
    db.flush()
    return category
