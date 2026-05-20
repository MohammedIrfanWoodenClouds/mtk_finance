"""Build finance PDF reports with ReportLab."""

from __future__ import annotations

from decimal import Decimal
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.services.daily_report_types import FinanceReportData


def _money(v: Decimal | float | int) -> str:
    if isinstance(v, Decimal):
        val = float(v)
    else:
        val = float(v)
    return f"₹{val:,.2f}"


def _date_range_label(data: FinanceReportData) -> str:
    if data.date_from == data.date_to:
        return data.date_from.isoformat()
    return f"{data.date_from.isoformat()} – {data.date_to.isoformat()}"


def build_finance_report_pdf(data: FinanceReportData) -> bytes:
    buffer = BytesIO()
    range_label = _date_range_label(data)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"MTK Finance {data.period_label} Report {range_label}",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=18,
        spaceAfter=6,
        textColor=colors.HexColor("#047857"),
    )
    h2 = styles["Heading2"]
    body = styles["BodyText"]
    small = ParagraphStyle("Small", parent=body, fontSize=9, textColor=colors.grey)

    story: list = []

    story.append(
        Paragraph(f"MTK Finance — {data.period_label} Report", title_style)
    )
    story.append(
        Paragraph(
            f"<b>{data.user_name}</b> · {range_label} · "
            f"Generated {data.generated_at}",
            small,
        )
    )
    story.append(Spacer(1, 8))

    summary_rows = [
        ["Total assets", _money(data.totals["total_assets"])],
        ["Total owed", _money(data.totals["total_liabilities"])],
        ["Net worth", _money(data.totals["net_worth"])],
    ]
    if data.totals.get("has_credit_limits"):
        summary_rows.append(
            ["Credit available", _money(data.totals["available_credit"])]
        )

    t0 = Table([["Metric", "Amount"], *summary_rows], colWidths=[80 * mm, 80 * mm])
    t0.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ecfdf5")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#f9fafb")],
                ),
            ]
        )
    )
    story.append(Paragraph("Balances summary (current)", h2))
    story.append(t0)
    story.append(Spacer(1, 10))

    if data.accounts:
        acc_rows = [["Account", "Type", "Balance"]]
        for a in data.accounts:
            acc_rows.append([a["name"], a["type"], _money(a["balance"])])
        t1 = Table(acc_rows, colWidths=[70 * mm, 45 * mm, 45 * mm])
        t1.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ecfdf5")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                ]
            )
        )
        story.append(Paragraph("Account balances", h2))
        story.append(t1)
        story.append(Spacer(1, 10))

    story.append(Paragraph(f"Transactions — {range_label}", h2))
    if data.transactions:
        tx_rows = [["Date", "Type", "Amount", "Notes"]]
        for tx in data.transactions:
            tx_rows.append(
                [
                    str(tx["date"]),
                    tx["type"],
                    _money(tx["amount"]),
                    (tx.get("notes") or "")[:40],
                ]
            )
        t2 = Table(tx_rows, colWidths=[28 * mm, 28 * mm, 32 * mm, 72 * mm])
        t2.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fff7ed")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(t2)
        story.append(
            Paragraph(
                f"Period totals — In: {_money(data.period_income)} · "
                f"Out: {_money(data.period_expense)}",
                small,
            )
        )
    else:
        story.append(Paragraph("No transactions in this period.", body))

    story.append(Spacer(1, 12))
    story.append(Paragraph("AI recommendations", h2))
    for block in data.recommendations.split("\n"):
        block = block.strip()
        if block:
            story.append(Paragraph(block.replace("\n", "<br/>"), body))
            story.append(Spacer(1, 4))

    doc.build(story)
    return buffer.getvalue()


def build_daily_report_pdf(data: FinanceReportData) -> bytes:
    """Alias used by legacy imports."""
    return build_finance_report_pdf(data)
