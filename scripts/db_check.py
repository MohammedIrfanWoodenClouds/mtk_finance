#!/usr/bin/env python3
"""Test Supabase/Postgres connection and seed admin user."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server"))

from sqlalchemy import text

from app.core.database import SessionLocal, engine
from app.seed import ADMIN_EMAIL, ensure_admin_user


def main() -> int:
    from app.core.config import get_settings

    settings = get_settings()
    uri = settings.sqlalchemy_database_uri
    placeholders = ("YOUR_DB_PASSWORD", "YOUR-PASSWORD", "[YOUR-PASSWORD]", "REPLACE_ME")
    if any(p in uri for p in placeholders):
        print("Password is still a placeholder in .env")
        print("  → Supabase → Project Settings → Database → Reset database password")
        print("  → Replace [YOUR-PASSWORD] in DATABASE_URL with that real password")
        return 1

    print("Testing database connection...")
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("  Connection: OK")
    except Exception as e:
        print(f"  Connection: FAILED\n  {e}")
        print("\nFix DATABASE_URL in .env (Supabase password & host).")
        return 1

    db = SessionLocal()
    try:
        user = ensure_admin_user(db)
        print(f"  Admin user: {user.email} (id={user.id})")
        count = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        print(f"  Total users: {count}")
    except Exception as e:
        print(f"  Seed: FAILED\n  {e}")
        print("\nRun migrations first: npm run db:migrate")
        return 1
    finally:
        db.close()

    print(f"\nLogin with:\n  Email:    {ADMIN_EMAIL}\n  Password: pass123")
    return 0


if __name__ == "__main__":
    sys.exit(main())
