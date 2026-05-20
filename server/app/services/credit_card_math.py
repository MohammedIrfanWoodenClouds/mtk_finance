"""Credit card balance semantics (signed balance stored on Account).

Industry model (issuer / personal finance apps):
- Positive signed balance = used limit (charges on the line)
- Negative signed balance = credit on card (overpayment)
- Available credit = credit limit − used limit
  (used limit = max(0, balance); full limit when balance < 0)

Never use ``balance - limit`` when balance is negative — that wrongly yields
-(limit + |credit|), e.g. -1300 - 33000 = -34300.
"""

from dataclasses import dataclass
from decimal import Decimal


def used_limit(balance: Decimal) -> Decimal:
    """Portion of the credit line in use (≥ 0)."""
    return max(Decimal("0"), balance)


def amount_owed(balance: Decimal) -> Decimal:
    """Alias for used_limit (ledger liability amount)."""
    return used_limit(balance)


def credit_balance(balance: Decimal) -> Decimal:
    """Overpayment amount (≥ 0) when balance is negative."""
    return max(Decimal("0"), -balance)


def available_credit(limit: Decimal, balance: Decimal) -> Decimal:
    """Spendable headroom on the card (may be negative if over limit)."""
    if limit <= 0:
        return Decimal("0")
    if balance < 0:
        return limit
    return limit - used_limit(balance)


def over_limit_amount(limit: Decimal, balance: Decimal) -> Decimal:
    """How far used limit exceeds the credit line (≥ 0)."""
    used = used_limit(balance)
    if limit <= 0 or used <= limit:
        return Decimal("0")
    return used - limit


def signed_balance_from_inputs(
    used: Decimal, credit_on_card: Decimal
) -> Decimal:
    """Map form fields to ledger signed balance."""
    if used > 0 and credit_on_card > 0:
        raise ValueError(
            "Cannot set both used limit and credit on card; clear one field."
        )
    if credit_on_card > 0:
        return -abs(credit_on_card)
    return max(Decimal("0"), used)


def inputs_from_signed_balance(
    balance: Decimal,
) -> tuple[Decimal, Decimal]:
    """Split ledger balance into (used_limit, credit_on_card) for forms."""
    return used_limit(balance), credit_balance(balance)


@dataclass(frozen=True)
class CreditCardMetrics:
    used_limit: Decimal
    credit_on_card: Decimal
    available: Decimal | None
    over_limit: Decimal
    utilization_pct: int | None
    signed_balance: Decimal


def credit_card_metrics(
    limit: Decimal | None, balance: Decimal
) -> CreditCardMetrics:
    """Full derived snapshot for API and reports."""
    used = used_limit(balance)
    credit = credit_balance(balance)
    avail: Decimal | None = None
    over = Decimal("0")
    util: int | None = None

    if limit is not None and limit > 0:
        avail = available_credit(limit, balance)
        over = over_limit_amount(limit, balance)
        if used > 0:
            util = int(round((used / limit) * 100))

    return CreditCardMetrics(
        used_limit=used,
        credit_on_card=credit,
        available=avail,
        over_limit=over,
        utilization_pct=util,
        signed_balance=balance,
    )


def validate_used_vs_limit(limit: Decimal | None, balance: Decimal) -> None:
    """No-op: over-limit balances are allowed (negative available credit)."""
    del limit, balance
