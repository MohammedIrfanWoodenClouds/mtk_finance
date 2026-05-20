from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)
from app.services import auth_service

router = APIRouter()


@router.post("/register", status_code=status.HTTP_403_FORBIDDEN)
def register_disabled():
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Registration is disabled. Use the admin account.",
    )


@router.post("/login", response_model=TokenResponse)
def login(
    data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    user, access, refresh = auth_service.authenticate_user(
        db, data, ip=ip, user_agent=user_agent
    )
    db.commit()
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    access, new_refresh = auth_service.refresh_access_token(db, data.refresh_token)
    db.commit()
    return TokenResponse(access_token=access, refresh_token=new_refresh)


@router.post("/logout")
def logout(data: RefreshRequest, db: Session = Depends(get_db)):
    auth_service.revoke_refresh_token(db, data.refresh_token)
    db.commit()
    return {"message": "Logged out"}


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    auth_service.change_password(
        db, user, data.current_password, data.new_password
    )
    db.commit()
    return {"message": "Password updated successfully"}


@router.post("/password-reset/request")
def password_reset_request(
    data: PasswordResetRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    from app.core.config import get_settings

    token = auth_service.request_password_reset(db, data.email)
    db.commit()

    settings = get_settings()
    internal_secret = request.headers.get("x-email-internal-secret", "")
    allow_token = (
        settings.EMAIL_INTERNAL_SECRET
        and internal_secret == settings.EMAIL_INTERNAL_SECRET
    )

    response: dict = {"message": "If the email exists, a reset link was sent"}
    if token and allow_token:
        response["reset_token"] = token
    return response


@router.post("/password-reset/confirm")
def password_reset_confirm(
    data: PasswordResetConfirm, db: Session = Depends(get_db)
):
    auth_service.confirm_password_reset(db, data.token, data.new_password)
    db.commit()
    return {"message": "Password updated"}


@router.get("/me", response_model=UserResponse)
def me(user=Depends(get_current_user)):
    return user
