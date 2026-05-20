import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_password_hash,
    verify_password,
)
from app.models.auth import LoginHistory, PasswordResetToken, RefreshToken
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services.category_service import seed_default_categories

settings = get_settings()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _check_login_lockout(db: Session, email: str) -> None:
    since = datetime.now(UTC) - timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
    failures = (
        db.query(LoginHistory)
        .filter(
            LoginHistory.email == email,
            LoginHistory.success.is_(False),
            LoginHistory.created_at >= since,
        )
        .count()
    )
    if failures >= settings.MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Try again later.",
        )


def _record_login(
    db: Session,
    email: str,
    success: bool,
    user_id: UUID | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    db.add(
        LoginHistory(
            user_id=user_id,
            email=email,
            success=success,
            ip_address=ip,
            user_agent=user_agent,
        )
    )


def register_user(db: Session, data: RegisterRequest) -> User:
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        full_name=data.full_name,
    )
    db.add(user)
    db.flush()
    seed_default_categories(db, user)
    return user


def authenticate_user(
    db: Session,
    data: LoginRequest,
    ip: str | None = None,
    user_agent: str | None = None,
) -> tuple[User, str, str]:
    _check_login_lockout(db, data.email)
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        _record_login(db, data.email, False, ip=ip, user_agent=user_agent)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    _record_login(db, data.email, True, user.id, ip=ip, user_agent=user_agent)
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    _store_refresh_token(db, user.id, refresh)
    return user, access, refresh


def _store_refresh_token(db: Session, user_id: UUID, token: str) -> None:
    expires = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(
        RefreshToken(
            user_id=user_id,
            token_hash=_hash_token(token),
            expires_at=expires,
        )
    )


def refresh_access_token(db: Session, refresh_token: str) -> tuple[str, str]:
    payload = decode_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    token_hash = _hash_token(refresh_token)
    stored = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked.is_(False),
            RefreshToken.expires_at > datetime.now(UTC),
        )
        .first()
    )
    if not stored:
        raise HTTPException(status_code=401, detail="Refresh token revoked or expired")

    user_id = UUID(payload["sub"])
    stored.revoked = True
    access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id)
    _store_refresh_token(db, user_id, new_refresh)
    return access, new_refresh


def revoke_refresh_token(db: Session, refresh_token: str) -> None:
    token_hash = _hash_token(refresh_token)
    stored = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .first()
    )
    if stored:
        stored.revoked = True


def request_password_reset(db: Session, email: str) -> str | None:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_token(token),
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )
    )
    return token


def change_password(
    db: Session, user: User, current_password: str, new_password: str
) -> None:
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if current_password == new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )
    user.password_hash = get_password_hash(new_password)


def confirm_password_reset(db: Session, token: str, new_password: str) -> None:
    token_hash = _hash_token(token)
    reset = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used.is_(False),
            PasswordResetToken.expires_at > datetime.now(UTC),
        )
        .first()
    )
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user = db.get(User, reset.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    user.password_hash = get_password_hash(new_password)
    reset.used = True
