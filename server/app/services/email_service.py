"""SMTP email with optional PDF attachment (mirrors Next.js mail env)."""

from __future__ import annotations

import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import Settings


def _normalize_app_password(pass_: str) -> str:
    return pass_.replace(" ", "")


def is_smtp_configured(settings: Settings) -> bool:
    return bool(settings.SMTP_USER.strip() and settings.SMTP_PASS.strip())


def resolve_delivery_address(settings: Settings, intended_to: str) -> tuple[str, bool]:
    mail_to = settings.MAIL_TO.strip()
    if mail_to:
        return mail_to, True
    return intended_to, False


def send_email_with_attachment(
    settings: Settings,
    *,
    intended_to: str,
    subject: str,
    text: str,
    html: str | None = None,
    attachment_bytes: bytes | None = None,
    attachment_filename: str = "report.pdf",
) -> None:
    if not is_smtp_configured(settings):
        raise RuntimeError(
            "SMTP is not configured. Set SMTP_USER and SMTP_PASS in .env"
        )

    to_addr, routed = resolve_delivery_address(settings, intended_to)
    from_addr = (settings.SMTP_FROM or settings.SMTP_USER).strip()

    if routed:
        subject = f"[MTK Finance] {subject}"
        banner = (
            f"[Routed to MAIL_TO — originally for {intended_to}]\n\n"
        )
        text = banner + text
        if html:
            html = (
                f'<p style="color:#666;font-size:12px">'
                f"Originally for: <strong>{intended_to}</strong></p>"
                + html
            )

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(text, "plain", "utf-8"))
    alt.attach(MIMEText(html or text.replace("\n", "<br>"), "html", "utf-8"))
    msg.attach(alt)

    if attachment_bytes:
        part = MIMEApplication(attachment_bytes, _subtype="pdf")
        part.add_header(
            "Content-Disposition",
            "attachment",
            filename=attachment_filename,
        )
        msg.attach(part)

    password = _normalize_app_password(settings.SMTP_PASS)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as smtp:
        smtp.starttls()
        smtp.login(settings.SMTP_USER.strip(), password)
        smtp.sendmail(from_addr, [to_addr], msg.as_string())
