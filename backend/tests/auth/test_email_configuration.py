from django.test import override_settings

from apps.accounts.checks import check_email_configuration
from config.email import default_from_email, normalize_smtp_password


def issue_ids():
    return {issue.id for issue in check_email_configuration(None)}


def test_gmail_app_password_spaces_are_removed():
    assert normalize_smtp_password("smtp.gmail.com", "abcd efgh ijkl mnop") == "abcdefghijklmnop"


def test_non_gmail_password_internal_spaces_are_preserved():
    assert normalize_smtp_password("smtp.example.com", "  alpha beta  ") == "alpha beta"


def test_default_sender_uses_authenticated_account_when_available():
    assert default_from_email("mailer@example.com") == "Game Store <mailer@example.com>"
    assert default_from_email("") == "Game Store <noreply@example.com>"


@override_settings(
    DEBUG=False,
    EMAIL_VERIFICATION_ENABLED=False,
    EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend",
    FRONTEND_URL="https://store.example.com",
    EMAIL_USE_TLS=False,
    EMAIL_USE_SSL=False,
)
def test_production_rejects_console_email_even_when_verification_is_disabled():
    assert "accounts.E006" in issue_ids()


@override_settings(
    DEBUG=False,
    EMAIL_VERIFICATION_ENABLED=True,
    EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
    EMAIL_HOST="smtp.example.com",
    EMAIL_PORT=587,
    FRONTEND_URL="http://store.example.com",
    EMAIL_USE_TLS=True,
    EMAIL_USE_SSL=True,
)
def test_production_email_rejects_http_links_and_conflicting_transport_security():
    assert {"accounts.E002", "accounts.E003"} <= issue_ids()


@override_settings(
    DEBUG=True,
    EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
    EMAIL_HOST="smtp.gmail.com",
    EMAIL_PORT=465,
    EMAIL_HOST_USER="mailer@example.com",
    EMAIL_HOST_PASSWORD="app-password",
    FRONTEND_URL="http://localhost:3000",
    EMAIL_USE_TLS=True,
    EMAIL_USE_SSL=False,
    EMAIL_TIMEOUT=10,
    EMAIL_VERIFICATION_TIMEOUT=86400,
    PASSWORD_RESET_TIMEOUT=3600,
)
def test_gmail_rejects_invalid_port_and_transport_pairing():
    assert "accounts.E009" in issue_ids()


@override_settings(
    DEBUG=False,
    EMAIL_VERIFICATION_ENABLED=True,
    EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
    EMAIL_HOST="smtp.gmail.com",
    EMAIL_PORT=587,
    EMAIL_HOST_USER="mailer@example.com",
    EMAIL_HOST_PASSWORD="app-password",
    FRONTEND_URL="https://store.example.com",
    EMAIL_USE_TLS=True,
    EMAIL_USE_SSL=False,
    EMAIL_TIMEOUT=10,
    EMAIL_VERIFICATION_TIMEOUT=86400,
    PASSWORD_RESET_TIMEOUT=3600,
)
def test_valid_gmail_configuration_passes_account_checks():
    assert check_email_configuration(None) == []
