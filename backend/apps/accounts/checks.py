from urllib.parse import urlparse

from django.conf import settings
from django.core.checks import Error, Warning, register

SMTP_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
CONSOLE_BACKEND = "django.core.mail.backends.console.EmailBackend"


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

    if settings.EMAIL_VERIFICATION_ENABLED and not settings.DEBUG:
        if settings.EMAIL_BACKEND == CONSOLE_BACKEND:
            issues.append(
                Error(
                    "Console email cannot deliver verification links in production.",
                    id="accounts.E006",
                )
            )
        elif settings.EMAIL_BACKEND == SMTP_BACKEND and not settings.EMAIL_HOST:
            issues.append(Error("EMAIL_HOST is required for SMTP delivery.", id="accounts.E007"))

    if settings.EMAIL_BACKEND == SMTP_BACKEND and bool(settings.EMAIL_HOST_USER) != bool(
        settings.EMAIL_HOST_PASSWORD
    ):
        issues.append(
            Warning(
                "Set both EMAIL_HOST_USER and EMAIL_HOST_PASSWORD, or leave both empty.",
                id="accounts.W001",
            )
        )
    return issues
