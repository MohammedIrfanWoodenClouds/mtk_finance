"""Add credit_limit for credit card accounts

Revision ID: 002_account_credit_limit
Revises: 001_initial_phase1
Create Date: 2026-05-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_account_credit_limit"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("credit_limit", sa.Numeric(18, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("accounts", "credit_limit")
