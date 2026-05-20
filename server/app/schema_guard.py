"""Verify production DB schema matches deployed models."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

# table -> columns introduced after initial deploy
REQUIRED_COLUMNS: dict[str, list[str]] = {
    "accounts": ["credit_limit"],
    "transactions": ["transfer_fee"],
}


def check_schema_columns(db: Session) -> dict:
    """Return {ok, missing} where missing is list of 'table.column'."""
    missing: list[str] = []
    for table, columns in REQUIRED_COLUMNS.items():
        for column in columns:
            row = db.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = :table
                      AND column_name = :column
                    """
                ),
                {"table": table, "column": column},
            ).first()
            if not row:
                missing.append(f"{table}.{column}")
    return {"ok": len(missing) == 0, "missing": missing}


SCHEMA_OUTDATED_DETAIL = (
    "Database schema is out of date. From the project root run: npm run db:migrate "
    "(requires DIRECT_URL in .env). Or apply pending Alembic migrations in Supabase."
)
