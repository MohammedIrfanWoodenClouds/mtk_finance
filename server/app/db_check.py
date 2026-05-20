"""Database connectivity check."""

from sqlalchemy import text
from sqlalchemy.orm import Session


def check_database(db: Session) -> dict:
    try:
        db.execute(text("SELECT 1"))
        user_count = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        return {
            "connected": True,
            "message": "Database connection OK",
            "user_count": user_count,
        }
    except Exception as e:
        return {
            "connected": False,
            "message": str(e),
            "user_count": None,
        }
