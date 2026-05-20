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
    def _validate_balanced(lines: list[LedgerLineInput]) -> None:
        total_debit = sum(line.debit for line in lines)
        total_credit = sum(line.credit for line in lines)
        if total_debit != total_credit:
            raise LedgerError("Journal entry is not balanced")
        if total_debit <= 0:
            raise LedgerError("Journal entry must have positive totals")

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

        self._validate_balanced(lines)
        for line in lines:
            acc = self.db.get(Account, line.account_id)
            if acc:
                self._apply_balance_delta(acc, line.debit, line.credit)

    def post_reconcile_balance(
        self, account: Account, target_balance: Decimal, note: str = "Balance update"
    ) -> Transaction | None:
        """Set account balance to target via balanced journal entry (adjustment)."""
        delta = target_balance - account.current_balance
        if delta == 0:
            return None

        equity = self.get_or_create_equity_account()
        amount = abs(delta)
        lines: list[LedgerLineInput] = []

        if account.account_type in ACCOUNT_TYPE_ASSET:
            if delta > 0:
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
            if delta > 0:
                lines = [
                    LedgerLineInput(account.id, credit=amount),
                    LedgerLineInput(equity.id, debit=amount),
                ]
            else:
                lines = [
                    LedgerLineInput(account.id, debit=amount),
                    LedgerLineInput(equity.id, credit=amount),
                ]
        else:
            if delta > 0:
                lines = [
                    LedgerLineInput(account.id, debit=amount),
                    LedgerLineInput(equity.id, credit=amount),
                ]
            else:
                lines = [
                    LedgerLineInput(account.id, credit=amount),
                    LedgerLineInput(equity.id, debit=amount),
                ]

        self._validate_balanced(lines)

        tx = Transaction(
            user_id=self.user_id,
            transaction_type=TRANSACTION_ADJUSTMENT,
            account_id=account.id,
            amount=amount,
            transaction_date=date.today(),
            notes=note,
            status=STATUS_POSTED,
        )
        self.db.add(tx)
        self.db.flush()

        entry = JournalEntry(
            transaction_id=tx.id,
            entry_date=tx.transaction_date,
            description=note,
        )
        self.db.add(entry)
        self.db.flush()

        for line in lines:
            acc = self.db.get(Account, line.account_id)
            if not acc or acc.user_id != self.user_id:
                raise LedgerError("Invalid account in reconcile entry")
            self.db.add(
                JournalLine(
                    journal_entry_id=entry.id,
                    account_id=line.account_id,
                    debit_amount=line.debit,
                    credit_amount=line.credit,
                )
            )
            self._apply_balance_delta(acc, line.debit, line.credit)

        account.current_balance = target_balance
        return tx

    def create_journal_for_transaction(
        self, transaction: Transaction, *, fee_ledger_account_id: UUID | None = None
    ) -> JournalEntry:
        lines = self._build_lines_for_transaction(
            transaction, fee_ledger_account_id=fee_ledger_account_id
        )
        self._validate_balanced(lines)

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

    def _build_transfer_lines(
        self,
        from_account_id: UUID,
        to_account_id: UUID,
        principal: Decimal,
        fee: Decimal,
        fee_ledger_account_id: UUID | None,
    ) -> list[LedgerLineInput]:
        """Move principal to destination; fee leaves source as expense."""
        if fee > 0 and not fee_ledger_account_id:
            raise LedgerError("Fee category required when transfer has a charge")

        lines: list[LedgerLineInput] = [
            LedgerLineInput(to_account_id, debit=principal),
            LedgerLineInput(from_account_id, credit=principal + fee),
        ]
        if fee > 0:
            if fee_ledger_account_id is None:
                raise LedgerError("Fee category required when transfer has a charge")
            lines.append(LedgerLineInput(fee_ledger_account_id, debit=fee))
        return lines

    def _build_lines_for_transaction(
        self,
        transaction: Transaction,
        *,
        fee_ledger_account_id: UUID | None = None,
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
            fee = transaction.transfer_fee or Decimal("0")
            return self._build_transfer_lines(
                transaction.account_id,
                transaction.counter_account_id,
                amount,
                fee,
                fee_ledger_account_id,
            )

        if transaction.transaction_type == TRANSACTION_ADJUSTMENT:
            return [
                LedgerLineInput(transaction.account_id, debit=amount),
                LedgerLineInput(
                    self.get_or_create_equity_account().id, credit=amount
                ),
            ]

        raise LedgerError(f"Unsupported transaction type: {transaction.transaction_type}")
