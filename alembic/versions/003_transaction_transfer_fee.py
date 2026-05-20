"""Add transfer_fee on transactions

Revision ID: 003_transaction_transfer_fee
Revises: 002_account_credit_limit
Create Date: 2026-05-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_transaction_transfer_fee"
down_revision: Union[str, None] = "002_account_credit_limit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column(
            "transfer_fee",
            sa.Numeric(18, 2),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("transactions", "transfer_fee")
