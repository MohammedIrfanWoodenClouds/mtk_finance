"""Backward-compatible re-exports — use report_service for new code."""

from app.services.report_service import (  # noqa: F401
    build_finance_report,
    email_finance_report,
    generated_at_label,
    report_date_for_timezone,
    run_daily_reports,
)

# Legacy names
build_report_data = build_finance_report
send_daily_report_for_user = email_finance_report
