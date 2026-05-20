"""Finance PDF reports: daily, weekly, monthly, or custom range."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.ai.gemini import generate_report_insights
from app.constants import ACCOUNT_TYPE_LABELS
from app.core.config import Settings, get_settings
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.report import FinanceReportRequest, ReportPeriod
from app.services.ai_context_service import build_finance_context
from app.services.balance_service import list_user_accounts, summarize_accounts
from app.services.credit_card_math import amount_owed, available_credit
from app.services.daily_report_types import FALLBACK_RECOMMENDATIONS, FinanceReportData
from app.services.email_service import is_smtp_configured, send_email_with_attachment
from app.services.pdf_report import build_finance_report_pdf

logger = logging.getLogger(__name__)

PERIOD_LABELS: dict[ReportPeriod, str] = {
    "daily": "Daily",
    "weekly": "Weekly",
    "monthly": "Monthly",
    "custom": "Custom",
}


def report_date_for_timezone(settings: Settings) -> date:
    try:
        tz = ZoneInfo(settings.REPORT_TIMEZONE)
    except Exception:
        tz = ZoneInfo("UTC")
    return datetime.now(tz).date()


def generated_at_label(settings: Settings) -> str:
    try:
        tz = ZoneInfo(settings.REPORT_TIMEZONE)
    except Exception:
        tz = ZoneInfo("UTC")
    return datetime.now(tz).strftime("%Y-%m-%d %H:%M %Z")


def resolve_period_range(
    req: FinanceReportRequest,
    settings: Settings,
) -> tuple[date, date, str]:
    today = report_date_for_timezone(settings)

    if req.period == "daily":
        return today, today, PERIOD_LABELS["daily"]
    if req.period == "weekly":
        start = today - timedelta(days=6)
        return start, today, PERIOD_LABELS["weekly"]
    if req.period == "monthly":
        start = today.replace(day=1)
        return start, today, PERIOD_LABELS["monthly"]
    if req.period == "custom":
        if req.date_from is None or req.date_to is None:
            raise HTTPException(
                status_code=400,
                detail="date_from and date_to are required for custom period",
            )
        if req.date_from > req.date_to:
            raise HTTPException(
                status_code=400,
                detail="date_from must be on or before date_to",
            )
        return req.date_from, req.date_to, PERIOD_LABELS["custom"]

    raise HTTPException(status_code=400, detail="Invalid period")


def _money(v: Decimal) -> str:
    return f"₹{v:,.2f}"


def _period_filename(period: ReportPeriod, date_from: date, date_to: date) -> str:
    if date_from == date_to:
        return f"mtk-finance-{period}-{date_from.isoformat()}.pdf"
    return f"mtk-finance-{period}-{date_from.isoformat()}-to-{date_to.isoformat()}.pdf"


def _period_subject(period_label: str, date_from: date, date_to: date) -> str:
    if date_from == date_to:
        return f"{period_label} report — {date_from.strftime('%d %b %Y')}"
    return (
        f"{period_label} report — "
        f"{date_from.strftime('%d %b %Y')} to {date_to.strftime('%d %b %Y')}"
    )


def _build_period_context(
    db: Session,
    user_id: UUID,
    date_from: date,
    date_to: date,
) -> tuple[list[dict], Decimal, Decimal, str]:
    categories = {
        c.id: c.name
        for c in db.query(Category).filter(Category.user_id == user_id).all()
    }

    txs = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= date_from,
            Transaction.transaction_date <= date_to,
            Transaction.status.in_(["posted", "finalized"]),
        )
        .order_by(Transaction.transaction_date.asc(), Transaction.created_at.asc())
        .all()
    )

    income = Decimal("0")
    expense = Decimal("0")
    rows: list[dict] = []
    lines: list[str] = []

    for tx in txs:
        amt = tx.amount
        if tx.transaction_type == "income":
            income += amt
        elif tx.transaction_type == "expense":
            expense += amt
        cat = categories.get(tx.category_id, "") if tx.category_id else ""
        rows.append(
            {
                "date": tx.transaction_date,
                "type": tx.transaction_type,
                "amount": amt,
                "notes": tx.notes or cat,
            }
        )
        lines.append(
            f"- {tx.transaction_date} {tx.transaction_type} {_money(amt)}"
            + (f" ({cat})" if cat else "")
            + (f" — {tx.notes}" if tx.notes else "")
        )

    range_label = (
        f"{date_from}" if date_from == date_to else f"{date_from} to {date_to}"
    )
    summary = (
        f"Activity for {range_label}: {len(txs)} entries. "
        f"Income {_money(income)}, expenses {_money(expense)}."
    )
    if lines:
        summary += "\n" + "\n".join(lines[:80])
        if len(lines) > 80:
            summary += f"\n… and {len(lines) - 80} more entries."
    else:
        summary += "\nNo transactions in this period."

    return rows, income, expense, summary


async def build_finance_report(
    db: Session,
    user: User,
    req: FinanceReportRequest,
    settings: Settings | None = None,
) -> tuple[FinanceReportData, bytes, str]:
    settings = settings or get_settings()
    date_from, date_to, period_label = resolve_period_range(req, settings)

    accounts = list_user_accounts(db, user.id)
    totals = summarize_accounts(accounts)

    account_rows: list[dict] = []
    for a in accounts:
        bal = a.current_balance or Decimal("0")
        label = ACCOUNT_TYPE_LABELS.get(a.account_type, a.account_type)
        extra = ""
        if a.account_type == "credit_card" and a.credit_limit:
            avail = available_credit(a.credit_limit, bal)
            extra = f", avail {_money(avail)}"
            if bal < 0:
                extra += f", credit {_money(-bal)}"
            elif amount_owed(bal) > 0:
                extra += f", owed {_money(amount_owed(bal))}"
        account_rows.append(
            {"name": a.name, "type": label + extra, "balance": bal}
        )

    tx_rows, income, expense, period_summary = _build_period_context(
        db, user.id, date_from, date_to
    )

    recommendations = FALLBACK_RECOMMENDATIONS
    if req.include_ai:
        finance_context = build_finance_context(db, user.id)
        try:
            recommendations = await generate_report_insights(
                finance_context=finance_context,
                day_summary=period_summary,
                settings=settings,
                period_label=period_label,
            )
        except Exception as e:
            logger.warning("Report AI insights failed for %s: %s", user.email, e)

    data = FinanceReportData(
        user_name=user.full_name,
        user_email=user.email,
        period_label=period_label,
        date_from=date_from,
        date_to=date_to,
        generated_at=generated_at_label(settings),
        totals=totals,
        accounts=account_rows,
        transactions=tx_rows,
        period_income=income,
        period_expense=expense,
        recommendations=recommendations,
    )
    pdf_bytes = build_finance_report_pdf(data)
    filename = _period_filename(req.period, date_from, date_to)
    return data, pdf_bytes, filename


async def email_finance_report(
    db: Session,
    user: User,
    req: FinanceReportRequest,
) -> dict:
    settings = get_settings()
    if not is_smtp_configured(settings):
        raise HTTPException(
            status_code=503,
            detail="Email not configured. Set SMTP_USER and SMTP_PASS in .env",
        )

    data, pdf_bytes, filename = await build_finance_report(db, user, req, settings)
    nw = Decimal(str(data.totals["net_worth"]))
    subject = _period_subject(data.period_label, data.date_from, data.date_to)

    send_email_with_attachment(
        settings,
        intended_to=user.email,
        subject=subject,
        text=(
            f"Hi {user.full_name},\n\n"
            f"Your MTK Finance {data.period_label.lower()} report "
            f"({data.date_from} to {data.date_to}) is attached.\n\n"
            f"Net worth: {_money(nw)}\n"
            f"Transactions in period: {len(data.transactions)}\n\n"
            f"— MTK Finance"
        ),
        html=(
            f"<p>Hi <strong>{user.full_name}</strong>,</p>"
            f"<p>Your <strong>{data.period_label}</strong> report is attached (PDF).</p>"
            f"<ul>"
            f"<li>Period: {data.date_from} – {data.date_to}</li>"
            f"<li>Net worth: {_money(nw)}</li>"
            f"<li>Transactions: {len(data.transactions)}</li>"
            f"</ul>"
        ),
        attachment_bytes=pdf_bytes,
        attachment_filename=filename,
    )

    return {
        "ok": True,
        "message": f"Report emailed (delivered per MAIL_TO routing)",
        "filename": filename,
        "period_label": data.period_label,
        "date_from": data.date_from,
        "date_to": data.date_to,
    }


async def run_daily_reports(db: Session, settings: Settings | None = None) -> dict:
    """Cron: send daily report for all users."""
    settings = settings or get_settings()

    if not settings.DAILY_REPORT_ENABLED:
        return {"status": "disabled", "sent": 0}

    if not is_smtp_configured(settings):
        return {"status": "error", "detail": "SMTP not configured", "sent": 0}

    req = FinanceReportRequest(period="daily", include_ai=True)
    users = db.query(User).all()
    sent = 0
    errors: list[str] = []

    for user in users:
        try:
            await email_finance_report(db, user, req)
            sent += 1
            logger.info("Daily report sent for %s", user.email)
        except Exception as e:
            logger.exception("Daily report failed for %s", user.email)
            errors.append(f"{user.email}: {e}")

    report_date = report_date_for_timezone(settings)
    return {
        "status": "ok",
        "report_date": report_date.isoformat(),
        "sent": sent,
        "users": len(users),
        "errors": errors,
    }
