from urllib.parse import urlparse

from django.conf import settings
from django.core.checks import Error, Warning, register

SMTP_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
CONSOLE_BACKEND = "django.core.mail.backends.console.EmailBackend"
GMAIL_SMTP_HOSTS = {"smtp.gmail.com", "smtp.googlemail.com"}


@register()
def check_email_configuration(app_configs, **kwargs):
    issues = []
    frontend = urlparse(settings.FRONTEND_URL)
    if frontend.scheme not in {"http", "https"} or not frontend.netloc:
        issues.append(
            Error(
                "FRONTEND_URL must be an absolute HTTP(S) URL for account links.",
                id="accounts.E001",
            )
        )
    elif not settings.DEBUG and frontend.scheme != "https":
        issues.append(
            Error(
                "FRONTEND_URL must use HTTPS outside development.",
                id="accounts.E002",
            )
        )

    if settings.EMAIL_USE_TLS and settings.EMAIL_USE_SSL:
        issues.append(
            Error(
                "EMAIL_USE_TLS and EMAIL_USE_SSL cannot both be enabled.",
                id="accounts.E003",
            )
        )
    if settings.EMAIL_TIMEOUT <= 0:
        issues.append(Error("EMAIL_TIMEOUT must be positive.", id="accounts.E004"))
    for name in ("EMAIL_VERIFICATION_TIMEOUT", "PASSWORD_RESET_TIMEOUT"):
        if getattr(settings, name) <= 0:
            issues.append(Error(f"{name} must be positive.", id="accounts.E005"))

    if not settings.DEBUG and settings.EMAIL_BACKEND == CONSOLE_BACKEND:
        issues.append(
            Error(
                "Console email cannot deliver account emails outside development.",
                id="accounts.E006",
            )
        )

    if settings.EMAIL_BACKEND == SMTP_BACKEND:
        if not settings.EMAIL_HOST:
            issues.append(Error("EMAIL_HOST is required for SMTP delivery.", id="accounts.E007"))
        if not 1 <= settings.EMAIL_PORT <= 65535:
            issues.append(
                Error(
                    "EMAIL_PORT must be between 1 and 65535.",
                    id="accounts.E008",
                )
            )
        if bool(settings.EMAIL_HOST_USER) != bool(settings.EMAIL_HOST_PASSWORD):
            issues.append(
                Warning(
                    "Set both EMAIL_HOST_USER and EMAIL_HOST_PASSWORD, or leave both empty.",
                    id="accounts.W001",
                )
            )

        if settings.EMAIL_HOST.lower() in GMAIL_SMTP_HOSTS:
            valid_gmail_transport = (
                settings.EMAIL_PORT == 587
                and settings.EMAIL_USE_TLS
                and not settings.EMAIL_USE_SSL
            ) or (
                settings.EMAIL_PORT == 465
                and settings.EMAIL_USE_SSL
                and not settings.EMAIL_USE_TLS
            )
            if not valid_gmail_transport:
                issues.append(
                    Error(
                        "Gmail SMTP requires port 587 with TLS or port 465 with SSL.",
                        id="accounts.E009",
                    )
                )

    return issues
