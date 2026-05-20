"""Credit card balance semantics (signed balance stored on Account).

Positive balance = used limit (amount charged on the line).
Negative balance = credit / overpayment on the card.

Available credit = credit limit − used limit
  (used limit = max(0, balance); full limit available when balance < 0)

Never use ``balance - limit`` with a negative balance — that wrongly yields
-(limit + |credit|), e.g. -1300 - 33000 = -34300.
"""

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
    """Spendable headroom on the card."""
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
