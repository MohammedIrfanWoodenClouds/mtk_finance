from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.report import (
    FinanceReportEmailRequest,
    FinanceReportEmailResponse,
    FinanceReportRequest,
)
from app.services.report_service import build_finance_report, email_finance_report

router = APIRouter()


@router.post("/finance/download")
async def download_finance_report(
    data: FinanceReportRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate PDF and return as file download."""
    _, pdf_bytes, filename = await build_finance_report(db, user, data)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post("/finance/email", response_model=FinanceReportEmailResponse)
async def send_finance_report_email(
    data: FinanceReportEmailRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate PDF and send to user email (via MAIL_TO routing)."""
    result = await email_finance_report(db, user, data)
    return FinanceReportEmailResponse(**result)
