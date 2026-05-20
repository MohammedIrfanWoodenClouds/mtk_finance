"""Credit card balance semantics (signed balance stored on Account).

Positive balance = amount owed on the statement.
Negative balance = credit / overpayment on the card.

Available credit (per Capital One / standard issuer math):
  - If you owe nothing (including overpayment): available = credit limit
  - If you owe amount D: available = credit limit − D
  - If D > limit: available is negative (over limit)

Never use ``balance - limit`` with a negative balance — that wrongly yields
-(limit + |credit|), e.g. -1300 - 33000 = -34300.
"""

from decimal import Decimal


def amount_owed(balance: Decimal) -> Decimal:
    """Debt portion of signed balance (≥ 0)."""
    return max(Decimal("0"), balance)


def credit_balance(balance: Decimal) -> Decimal:
    """Overpayment amount (≥ 0) when balance is negative."""
    return max(Decimal("0"), -balance)


def available_credit(limit: Decimal, balance: Decimal) -> Decimal:
    """Spendable headroom on the card."""
    if limit <= 0:
        return Decimal("0")
    if balance < 0:
        # Credit on card: owed is zero, full limit remains available
        return limit
    # balance ≥ 0 counts as statement debt (may exceed limit)
    return limit - balance


def over_limit_amount(limit: Decimal, balance: Decimal) -> Decimal:
    """How far past the limit when owed exceeds limit (≥ 0)."""
    if limit <= 0 or balance <= limit:
        return Decimal("0")
    return balance - limit
