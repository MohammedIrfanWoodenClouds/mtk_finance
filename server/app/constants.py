ACCOUNT_TYPE_ASSET = {"bank", "cash", "investment"}
ACCOUNT_TYPE_LIABILITY = {"credit_card", "loan", "loan_personal"}
ACCOUNT_TYPE_EQUITY = {"equity"}

ALL_USER_ACCOUNT_TYPES = ACCOUNT_TYPE_ASSET | ACCOUNT_TYPE_LIABILITY

ACCOUNT_TYPE_LABELS: dict[str, str] = {
    "bank": "Savings / Bank",
    "cash": "Cash wallet",
    "investment": "Investment",
    "credit_card": "Credit card",
    "loan": "Bank loan",
    "loan_personal": "Personal loan (friends & family)",
}

OPENING_BALANCE_EQUITY_NAME = "Opening Balance Equity"
OPENING_BALANCE_EQUITY_TYPE = "equity"

TRANSACTION_INCOME = "income"
TRANSACTION_EXPENSE = "expense"
TRANSACTION_TRANSFER = "transfer"
TRANSACTION_ADJUSTMENT = "adjustment"

STATUS_POSTED = "posted"
STATUS_FINALIZED = "finalized"

DEFAULT_CATEGORIES = [
    ("Salary", "income", "#22c55e"),
    ("Freelance", "income", "#16a34a"),
    ("Food", "expense", "#ef4444"),
    ("Transport", "expense", "#f97316"),
    ("Shopping", "expense", "#eab308"),
    ("Bills", "expense", "#6366f1"),
    ("Transfer fees", "expense", "#64748b"),
    ("Health", "expense", "#ec4899"),
    ("Entertainment", "expense", "#8b5cf6"),
    ("Stocks", "investment", "#0ea5e9"),
    ("Mutual Funds", "investment", "#06b6d4"),
]


def is_asset_account(account_type: str) -> bool:
    return account_type in ACCOUNT_TYPE_ASSET


def is_liability_account(account_type: str) -> bool:
    return account_type in ACCOUNT_TYPE_LIABILITY


def validate_user_account_type(account_type: str) -> None:
    if account_type not in ALL_USER_ACCOUNT_TYPES:
        allowed = ", ".join(sorted(ALL_USER_ACCOUNT_TYPES))
        raise ValueError(f"Invalid account_type. Allowed: {allowed}")
