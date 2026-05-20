from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.constants import ACCOUNT_TYPE_LABELS, is_liability_account
from app.models.category import Category
from app.models.transaction import Transaction
from app.services.balance_service import list_user_accounts, summarize_accounts


def _decimal_str(v: Decimal | None) -> str:
    return str(v or 0)


def build_finance_context(db: Session, user_id: UUID) -> str:
    accounts = list_user_accounts(db, user_id)
    totals = summarize_accounts(accounts)

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

    asset_accounts = [a for a in accounts if not is_liability_account(a.account_type)]
    liability_accounts = [a for a in accounts if is_liability_account(a.account_type)]

    lines = [
        "## User financial snapshot (read-only)",
        f"Total assets (cash, bank, investments): {_decimal_str(totals['total_assets'])}",
        f"Total liabilities owed (cards, loans): {_decimal_str(totals['total_liabilities'])}",
        f"Net worth (assets minus liabilities): {_decimal_str(totals['net_worth'])}",
        "",
        "### Assets",
    ]

    if not asset_accounts:
        lines.append("- No asset accounts")
    else:
        for a in asset_accounts:
            lines.append(
                f"- {a.name} ({ACCOUNT_TYPE_LABELS.get(a.account_type, a.account_type)}): "
                f"{_decimal_str(a.current_balance)}"
            )

    lines.extend(["", "### Liabilities (amount owed — not your money)"])
    if not liability_accounts:
        lines.append("- No credit cards or loans")
    else:
        for a in liability_accounts:
            label = ACCOUNT_TYPE_LABELS.get(a.account_type, a.account_type)
            extra = ""
            if a.account_type == "credit_card" and a.credit_limit:
                extra = f", limit {_decimal_str(a.credit_limit)}"
            if a.institution_name:
                extra += f", lender/issuer: {a.institution_name}"
            lines.append(
                f"- {a.name} ({label}): owed {_decimal_str(a.current_balance)}{extra}"
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
            cat_name = (
                categories.get(tx.category_id, "Uncategorized")
                if tx.category_id
                else "Uncategorized"
            )
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
        for name, total in sorted(
            expense_by_cat.items(), key=lambda x: x[1], reverse=True
        )[:12]:
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
