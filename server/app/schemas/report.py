from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator


ReportPeriod = Literal["daily", "weekly", "monthly", "custom"]


class FinanceReportRequest(BaseModel):
    period: ReportPeriod = "daily"
    date_from: date | None = None
    date_to: date | None = None
    include_ai: bool = True


class FinanceReportEmailRequest(FinanceReportRequest):
    pass


class FinanceReportEmailResponse(BaseModel):
    ok: bool = True
    message: str
    filename: str
    period_label: str
    date_from: date
    date_to: date
