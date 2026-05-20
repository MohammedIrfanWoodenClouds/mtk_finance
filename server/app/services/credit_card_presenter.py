"""Serialize accounts with derived credit-card metrics."""

from decimal import Decimal

from app.models.account import Account
from app.schemas.account import AccountResponse, CreditCardMetricsResponse
from app.services.credit_card_math import credit_card_metrics


def _effective_limit(account: Account) -> Decimal | None:
    lim = account.credit_limit
    if lim is not None and lim > 0:
        return lim
    return None


def metrics_for_account(account: Account) -> CreditCardMetricsResponse | None:
    if account.account_type != "credit_card":
        return None
    balance = account.current_balance or Decimal("0")
    m = credit_card_metrics(_effective_limit(account), balance)
    return CreditCardMetricsResponse(
        used_limit=m.used_limit,
        credit_on_card=m.credit_on_card,
        available=m.available,
        over_limit=m.over_limit,
        utilization_pct=m.utilization_pct,
        signed_balance=m.signed_balance,
    )


def account_response(account: Account) -> AccountResponse:
    base = AccountResponse.model_validate(account)
    cc = metrics_for_account(account)
    if cc is None:
        return base
    return base.model_copy(update={"credit_card": cc})
