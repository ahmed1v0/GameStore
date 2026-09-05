from django.test import override_settings

from apps.accounts.checks import check_email_configuration


def issue_ids():
    return {issue.id for issue in check_email_configuration(None)}


@override_settings(
    DEBUG=False,
    EMAIL_VERIFICATION_ENABLED=True,
    EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend",
    FRONTEND_URL="https://store.example.com",
    EMAIL_USE_TLS=False,
    EMAIL_USE_SSL=False,
)
def test_production_verification_rejects_console_email():
    assert "accounts.E006" in issue_ids()


@override_settings(
    DEBUG=False,
    EMAIL_VERIFICATION_ENABLED=True,
    EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
    EMAIL_HOST="smtp.example.com",
    FRONTEND_URL="http://store.example.com",
    EMAIL_USE_TLS=True,
    EMAIL_USE_SSL=True,
)
def test_production_email_rejects_http_links_and_conflicting_transport_security():
    assert {"accounts.E002", "accounts.E003"} <= issue_ids()


@override_settings(
    DEBUG=False,
    EMAIL_VERIFICATION_ENABLED=True,
    EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
    EMAIL_HOST="smtp.example.com",
    EMAIL_HOST_USER="mailer",
    EMAIL_HOST_PASSWORD="app-password",
    FRONTEND_URL="https://store.example.com",
    EMAIL_USE_TLS=True,
    EMAIL_USE_SSL=False,
    EMAIL_TIMEOUT=10,
    EMAIL_VERIFICATION_TIMEOUT=86400,
    PASSWORD_RESET_TIMEOUT=3600,
)
def test_valid_production_email_configuration_passes_account_checks():
    assert check_email_configuration(None) == []
