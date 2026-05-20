"""Scheduled jobs (Vercel Cron / manual trigger)."""

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.services.report_service import run_daily_reports

router = APIRouter()


def _verify_cron_caller(
    request: Request,
    authorization: str | None = Header(default=None),
) -> None:
    settings = get_settings()

    if request.headers.get("x-vercel-cron") == "1":
        return

    secret = settings.CRON_SECRET.strip() or settings.EMAIL_INTERNAL_SECRET.strip()
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="Cron not secured. Set CRON_SECRET or EMAIL_INTERNAL_SECRET.",
        )

    if authorization != f"Bearer {secret}":
        raise HTTPException(status_code=401, detail="Unauthorized cron request")


@router.get("/daily-report")
async def trigger_daily_report(
    request: Request,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    """
    Send daily PDF report to all users (11:59 PM via Vercel Cron).

    Secured by `x-vercel-cron: 1` or `Authorization: Bearer <CRON_SECRET>`.
    """
    _verify_cron_caller(request, authorization)
    result = await run_daily_reports(db)
    return result
