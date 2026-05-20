"""Idempotent database seed for single admin user."""

from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.user import User
from app.services.category_service import seed_default_categories

ADMIN_EMAIL = "admin@mtkfin.com"
ADMIN_PASSWORD = "pass123"
ADMIN_NAME = "Admin"


def ensure_admin_user(db: Session) -> User:
    user = db.query(User).filter(User.email == ADMIN_EMAIL).first()
    if user:
        return user

    user = User(
        email=ADMIN_EMAIL,
        password_hash=get_password_hash(ADMIN_PASSWORD),
        full_name=ADMIN_NAME,
    )
    db.add(user)
    db.flush()
    seed_default_categories(db, user)
    db.refresh(user)
    return user
