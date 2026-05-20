from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

FALLBACK_RECOMMENDATIONS = """• Review spending for this period against your budget.
• Keep credit card balances within limits to protect available credit.
• Move surplus cash to savings when asset balances allow.
• Log any missing transactions so your ledger stays accurate."""


@dataclass
class FinanceReportData:
    user_name: str
    user_email: str
    period_label: str
    date_from: date
    date_to: date
    generated_at: str
    totals: dict
    accounts: list[dict] = field(default_factory=list)
    transactions: list[dict] = field(default_factory=list)
    period_income: Decimal = Decimal("0")
    period_expense: Decimal = Decimal("0")
    recommendations: str = FALLBACK_RECOMMENDATIONS

    @property
    def report_date(self) -> date:
        """Backward compatibility for daily cron."""
        return self.date_to


# Alias for existing imports
DailyReportData = FinanceReportData
