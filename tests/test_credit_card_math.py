import json
from decimal import Decimal
from pathlib import Path

from app.services.credit_card_math import (
    available_credit,
    credit_balance,
    credit_card_metrics,
    inputs_from_signed_balance,
    signed_balance_from_inputs,
    used_limit,
)

FIXTURES = Path(__file__).parent / "fixtures" / "credit_card_cases.json"


def test_credit_balance_keeps_full_limit():
    limit = Decimal("33000")
    balance = Decimal("-1300")
    assert available_credit(limit, balance) == Decimal("33000")
    assert credit_balance(balance) == Decimal("1300")
    assert used_limit(balance) == Decimal("0")
    assert balance - limit == Decimal("-34300")


def test_over_limit_shows_negative_available_not_minus_limit_plus_credit():
    limit = Decimal("33000")
    balance = Decimal("34300")
    assert available_credit(limit, balance) == Decimal("-1300")


def test_normal_utilization():
    limit = Decimal("33000")
    balance = Decimal("10000")
    assert available_credit(limit, balance) == Decimal("23000")


def test_signed_balance_from_inputs():
    assert signed_balance_from_inputs(Decimal("10000"), Decimal("0")) == Decimal(
        "10000"
    )
    assert signed_balance_from_inputs(Decimal("0"), Decimal("1300")) == Decimal("-1300")


def test_inputs_from_signed_balance_roundtrip():
    balance = Decimal("-1300")
    used, credit = inputs_from_signed_balance(balance)
    assert used == Decimal("0")
    assert credit == Decimal("1300")
    assert signed_balance_from_inputs(used, credit) == balance


def test_credit_card_metrics_fixture_cases():
    cases = json.loads(FIXTURES.read_text(encoding="utf-8"))
    for case in cases:
        limit = Decimal(case["limit"])
        balance = Decimal(case["balance"])
        m = credit_card_metrics(limit, balance)
        assert m.used_limit == Decimal(case["used_limit"]), case["name"]
        assert m.credit_on_card == Decimal(case["credit_on_card"]), case["name"]
        assert m.available == Decimal(case["available"]), case["name"]
        if "over_limit" in case:
            assert m.over_limit == Decimal(case["over_limit"]), case["name"]


def test_over_limit_metrics():
    m = credit_card_metrics(Decimal("33000"), Decimal("34300"))
    assert m.available == Decimal("-1300")
    assert m.over_limit == Decimal("1300")
    assert m.utilization_pct == 104
