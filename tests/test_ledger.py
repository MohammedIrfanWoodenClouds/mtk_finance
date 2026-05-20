from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.ledger.engine import LedgerEngine, LedgerLineInput
from app.models.account import Account
from app.models.user import User


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    user = User(
        email="test@example.com",
        password_hash="hash",
        full_name="Test User",
    )
    session.add(user)
    session.flush()
    yield session, user
    session.close()


def test_journal_lines_must_balance():
    lines = [
        LedgerLineInput(account_id=None, debit=Decimal("100")),  # type: ignore
        LedgerLineInput(account_id=None, credit=Decimal("50")),  # type: ignore
    ]
    with pytest.raises(Exception):
        LedgerEngine._validate_balanced(lines, Decimal("100"))


def test_asset_balance_increases_on_debit(db_session):
    session, user = db_session
    account = Account(
        user_id=user.id,
        name="Bank",
        account_type="bank",
        opening_balance=Decimal("0"),
        current_balance=Decimal("0"),
    )
    session.add(account)
    session.flush()
    engine = LedgerEngine(session, user.id)
    engine._apply_balance_delta(account, Decimal("100"), Decimal("0"))
    assert account.current_balance == Decimal("100")
