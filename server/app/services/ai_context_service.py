from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.category import Category
from app.models.transaction import Transaction


def _decimal_str(v: Decimal | None) -> str:
    return str(v or 0)


def build_finance_context(db: Session, user_id: UUID) -> str:
    accounts = (
        db.query(Account)
        .filter(
            Account.user_id == user_id,
            Account.is_active.is_(True),
            Account.is_system.is_(False),
            Account.account_type.notlike("category_%"),
        )
        .all()
    )

    since = date.today() - timedelta(days=90)
    transactions = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= since,
            Transaction.status.in_(["posted", "finalized"]),
        )
        .order_by(Transaction.transaction_date.desc())
        .limit(50)
        .all()
    )

    categories = {
        c.id: c.name
        for c in db.query(Category).filter(Category.user_id == user_id).all()
    }

    total_balance = sum(a.current_balance for a in accounts)
    lines = [
        "## User financial snapshot (read-only)",
        f"Total balance across accounts: {_decimal_str(total_balance)}",
        "",
        "### Accounts",
    ]

    if not accounts:
        lines.append("- No accounts yet")
    else:
        for a in accounts:
            lines.append(
                f"- {a.name} ({a.account_type}): balance {_decimal_str(a.current_balance)}"
            )

    expense_by_cat: dict[str, Decimal] = {}
    income_total = Decimal("0")
    expense_total = Decimal("0")

    for tx in transactions:
        amt = tx.amount
        if tx.transaction_type == "income":
            income_total += amt
        elif tx.transaction_type == "expense":
            expense_total += amt
            cat_name = categories.get(tx.category_id, "Uncategorized") if tx.category_id else "Uncategorized"
            expense_by_cat[cat_name] = expense_by_cat.get(cat_name, Decimal("0")) + amt

    lines.extend(
        [
            "",
            f"### Last 90 days summary ({len(transactions)} transactions)",
            f"- Total money in: {_decimal_str(income_total)}",
            f"- Total money out: {_decimal_str(expense_total)}",
            "",
            "### Spending by category",
        ]
    )

    if expense_by_cat:
        for name, total in sorted(expense_by_cat.items(), key=lambda x: x[1], reverse=True)[:12]:
            lines.append(f"- {name}: {_decimal_str(total)}")
    else:
        lines.append("- No expenses recorded")

    lines.extend(["", "### Recent activity (latest 10)"])
    for tx in transactions[:10]:
        cat = categories.get(tx.category_id, "") if tx.category_id else ""
        lines.append(
            f"- {tx.transaction_date} | {tx.transaction_type} | {_decimal_str(tx.amount)} | {cat} | {tx.notes or ''}"
        )

    return "\n".join(lines)
