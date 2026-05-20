"""Credit card balance semantics (signed balance stored on Account).

Issuer / personal-finance model (see Experian, cardmember agreements):
- **Credit limit** — maximum line extended by the issuer.
- **Balance owed (used limit)** — positive ledger balance = charges on the line.
- **Credit on card** — negative ledger balance = overpayment (not the same as over-limit).
- **Available credit** = limit − used limit (negative when over limit).
- **Over-limit amount** = max(0, used limit − limit) — usage beyond the approved line.

Over-limit is allowed and recorded; issuers may approve transactions past the limit
or charge over-limit fees. This app tracks the full owed amount and reports over-limit
separately for clarity.
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


def within_limit_used(limit: Decimal, balance: Decimal) -> Decimal:
    """Used amount counting toward the credit line (capped at limit)."""
    if limit <= 0:
        return used_limit(balance)
    return min(used_limit(balance), limit)


def available_credit(limit: Decimal, balance: Decimal) -> Decimal:
    """Spendable headroom (negative when over limit)."""
    if limit <= 0:
        return Decimal("0")
    if balance < 0:
        return limit
    return limit - used_limit(balance)


def over_limit_amount(limit: Decimal, balance: Decimal) -> Decimal:
    """Usage beyond the credit line (≥ 0)."""
    used = used_limit(balance)
    if limit <= 0 or used <= limit:
        return Decimal("0")
    return used - limit


def is_over_limit(limit: Decimal | None, balance: Decimal) -> bool:
    if limit is None or limit <= 0:
        return False
    return used_limit(balance) > limit


def utilization_pct(limit: Decimal, balance: Decimal) -> int | None:
    """Used / limit × 100; may exceed 100 when over limit."""
    if limit <= 0:
        return None
    used = used_limit(balance)
    if used <= 0:
        return 0
    return int(round((used / limit) * 100))


def signed_balance_from_inputs(
    used: Decimal, credit_on_card: Decimal
) -> Decimal:
    """Map form fields to ledger signed balance."""
    if used > 0 and credit_on_card > 0:
        raise ValueError(
            "Cannot set both balance owed and credit on card; clear one field."
        )
    if credit_on_card > 0:
        return -abs(credit_on_card)
    return max(Decimal("0"), used)


def signed_balance_from_limit_and_over(
    limit: Decimal, over_limit: Decimal, credit_on_card: Decimal
) -> Decimal:
    """Build balance from limit + explicit over-limit usage (professional entry path)."""
    if over_limit < 0:
        raise ValueError("Over-limit amount cannot be negative")
    used = limit + over_limit if limit > 0 else over_limit
    return signed_balance_from_inputs(used, credit_on_card)


def inputs_from_signed_balance(
    balance: Decimal,
) -> tuple[Decimal, Decimal]:
    """Split ledger balance into (used_limit, credit_on_card) for forms."""
    return used_limit(balance), credit_balance(balance)


@dataclass(frozen=True)
class CreditCardMetrics:
    used_limit: Decimal
    within_limit_used: Decimal
    credit_on_card: Decimal
    available: Decimal | None
    over_limit: Decimal
    is_over_limit: bool
    utilization_pct: int | None
    signed_balance: Decimal


def credit_card_metrics(
    limit: Decimal | None, balance: Decimal
) -> CreditCardMetrics:
    """Full derived snapshot for API, reports, and UI."""
    used = used_limit(balance)
    credit = credit_balance(balance)
    lim = limit if limit is not None and limit > 0 else None
    avail: Decimal | None = None
    over = Decimal("0")
    within = used
    util: int | None = None
    over_flag = False

    if lim is not None:
        avail = available_credit(lim, balance)
        over = over_limit_amount(lim, balance)
        within = within_limit_used(lim, balance)
        over_flag = over > 0
        util = utilization_pct(lim, balance)

    return CreditCardMetrics(
        used_limit=used,
        within_limit_used=within,
        credit_on_card=credit,
        available=avail,
        over_limit=over,
        is_over_limit=over_flag,
        utilization_pct=util,
        signed_balance=balance,
    )
