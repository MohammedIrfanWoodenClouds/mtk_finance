from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.constants import (
    ACCOUNT_TYPE_ASSET,
    ACCOUNT_TYPE_EQUITY,
    ACCOUNT_TYPE_LIABILITY,
    OPENING_BALANCE_EQUITY_NAME,
    OPENING_BALANCE_EQUITY_TYPE,
    STATUS_POSTED,
    TRANSACTION_ADJUSTMENT,
    TRANSACTION_EXPENSE,
    TRANSACTION_INCOME,
    TRANSACTION_TRANSFER,
)
from app.models.account import Account
from app.models.journal import JournalEntry, JournalLine
from app.models.transaction import Transaction


class LedgerError(Exception):
    pass


@dataclass
class LedgerLineInput:
    account_id: UUID
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")


class LedgerEngine:
    def __init__(self, db: Session, user_id: UUID):
        self.db = db
        self.user_id = user_id

    def get_or_create_equity_account(self) -> Account:
        equity = (
            self.db.query(Account)
            .filter(
                Account.user_id == self.user_id,
                Account.account_type == OPENING_BALANCE_EQUITY_TYPE,
                Account.is_system.is_(True),
            )
            .first()
        )
        if equity:
            return equity
        equity = Account(
            user_id=self.user_id,
            name=OPENING_BALANCE_EQUITY_NAME,
            account_type=OPENING_BALANCE_EQUITY_TYPE,
            opening_balance=Decimal("0"),
            current_balance=Decimal("0"),
            is_system=True,
            is_active=True,
        )
        self.db.add(equity)
        self.db.flush()
        return equity

    @staticmethod
    def _validate_balanced(lines: list[LedgerLineInput], amount: Decimal) -> None:
        total_debit = sum(line.debit for line in lines)
        total_credit = sum(line.credit for line in lines)
        if total_debit != total_credit:
            raise LedgerError("Journal entry is not balanced")
        if total_debit != amount:
            raise LedgerError("Journal totals do not match transaction amount")

    def _apply_balance_delta(self, account: Account, debit: Decimal, credit: Decimal) -> None:
        if account.account_type in ACCOUNT_TYPE_ASSET:
            account.current_balance += debit - credit
        elif account.account_type in ACCOUNT_TYPE_LIABILITY:
            account.current_balance += credit - debit
        elif (
            account.account_type in ACCOUNT_TYPE_EQUITY
            or account.account_type.startswith("category_")
        ):
            account.current_balance += credit - debit
        else:
            account.current_balance += debit - credit

    def post_opening_balance(self, account: Account) -> None:
        if account.opening_balance == 0:
            return
        equity = self.get_or_create_equity_account()
        amount = abs(account.opening_balance)
        lines: list[LedgerLineInput] = []

        if account.account_type in ACCOUNT_TYPE_ASSET:
            if account.opening_balance >= 0:
                lines = [
                    LedgerLineInput(account.id, debit=amount),
                    LedgerLineInput(equity.id, credit=amount),
                ]
            else:
                lines = [
                    LedgerLineInput(account.id, credit=amount),
                    LedgerLineInput(equity.id, debit=amount),
                ]
        elif account.account_type in ACCOUNT_TYPE_LIABILITY:
            lines = [
                LedgerLineInput(account.id, credit=amount),
                LedgerLineInput(equity.id, debit=amount),
            ]
        else:
            lines = [
                LedgerLineInput(account.id, debit=amount),
                LedgerLineInput(equity.id, credit=amount),
            ]

        self._validate_balanced(lines, amount)
        for line in lines:
            acc = self.db.get(Account, line.account_id)
            if acc:
                self._apply_balance_delta(acc, line.debit, line.credit)

    def create_journal_for_transaction(self, transaction: Transaction) -> JournalEntry:
        lines = self._build_lines_for_transaction(transaction)
        self._validate_balanced(lines, transaction.amount)

        entry = JournalEntry(
            transaction_id=transaction.id,
            entry_date=transaction.transaction_date,
            description=transaction.notes,
        )
        self.db.add(entry)
        self.db.flush()

        for line in lines:
            account = self.db.get(Account, line.account_id)
            if not account or account.user_id != self.user_id:
                raise LedgerError("Invalid account in journal line")
            self.db.add(
                JournalLine(
                    journal_entry_id=entry.id,
                    account_id=line.account_id,
                    debit_amount=line.debit,
                    credit_amount=line.credit,
                )
            )
            self._apply_balance_delta(account, line.debit, line.credit)

        transaction.status = STATUS_POSTED
        return entry

    def _build_lines_for_transaction(
        self, transaction: Transaction
    ) -> list[LedgerLineInput]:
        amount = transaction.amount
        account = self.db.get(Account, transaction.account_id)
        if not account:
            raise LedgerError("Primary account not found")

        if transaction.transaction_type == TRANSACTION_INCOME:
            if not transaction.category_id:
                raise LedgerError("Category required for income")
            return [
                LedgerLineInput(transaction.account_id, debit=amount),
                LedgerLineInput(transaction.category_id, credit=amount),
            ]

        if transaction.transaction_type == TRANSACTION_EXPENSE:
            if not transaction.category_id:
                raise LedgerError("Category required for expense")
            return [
                LedgerLineInput(transaction.category_id, debit=amount),
                LedgerLineInput(transaction.account_id, credit=amount),
            ]

        if transaction.transaction_type == TRANSACTION_TRANSFER:
            if not transaction.counter_account_id:
                raise LedgerError("Counter account required for transfer")
            return [
                LedgerLineInput(transaction.counter_account_id, debit=amount),
                LedgerLineInput(transaction.account_id, credit=amount),
            ]

        if transaction.transaction_type == TRANSACTION_ADJUSTMENT:
            return [
                LedgerLineInput(transaction.account_id, debit=amount),
                LedgerLineInput(
                    self.get_or_create_equity_account().id, credit=amount
                ),
            ]

        raise LedgerError(f"Unsupported transaction type: {transaction.transaction_type}")
