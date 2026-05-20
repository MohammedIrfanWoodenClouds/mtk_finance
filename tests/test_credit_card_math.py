from decimal import Decimal

from app.services.credit_card_math import available_credit, credit_balance, amount_owed


def test_credit_balance_keeps_full_limit():
    limit = Decimal("33000")
    balance = Decimal("-1300")
    assert available_credit(limit, balance) == Decimal("33000")
    assert credit_balance(balance) == Decimal("1300")
    assert amount_owed(balance) == Decimal("0")
    # Wrong formula users must never see:
    assert balance - limit == Decimal("-34300")


def test_over_limit_shows_negative_available_not_minus_limit_plus_credit():
    limit = Decimal("33000")
    balance = Decimal("34300")
    assert available_credit(limit, balance) == Decimal("-1300")


def test_normal_utilization():
    limit = Decimal("33000")
    balance = Decimal("10000")
    assert available_credit(limit, balance) == Decimal("23000")
