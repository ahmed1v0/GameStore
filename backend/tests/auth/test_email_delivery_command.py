import smtplib
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

SMTP_BACKEND = "django.core.mail.backends.smtp.EmailBackend"


@override_settings(
    EMAIL_BACKEND=SMTP_BACKEND,
    EMAIL_HOST="smtp.example.com",
    EMAIL_PORT=587,
    EMAIL_HOST_USER="mailer@example.com",
    EMAIL_HOST_PASSWORD="app-password",
    EMAIL_USE_TLS=True,
    EMAIL_USE_SSL=False,
    DEFAULT_FROM_EMAIL="Game Store <mailer@example.com>",
)
def test_email_delivery_command_sends_text_and_html_without_exposing_password():
    output = StringIO()
    with patch("django.core.mail.EmailMultiAlternatives.send", return_value=1) as send:
        call_command("test_email_delivery", "owner@example.com", stdout=output)

    text = output.getvalue()
    assert "SMTP accepted" in text
    assert "smtp.example.com:587" in text
    assert "mailer@example.com" in text
    assert "app-password" not in text
    assert send.call_count == 1


def test_email_delivery_command_validates_recipient():
    with pytest.raises(CommandError, match="valid email"):
        call_command("test_email_delivery", "not-an-address")


@override_settings(EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend")
def test_email_delivery_command_rejects_non_smtp_backend():
    with pytest.raises(CommandError, match="EMAIL_BACKEND"):
        call_command("test_email_delivery", "owner@example.com")


@override_settings(
    EMAIL_BACKEND=SMTP_BACKEND,
    EMAIL_HOST="smtp.gmail.com",
    EMAIL_PORT=587,
    EMAIL_HOST_USER="mailer@gmail.com",
    EMAIL_HOST_PASSWORD="app-password",
    EMAIL_USE_TLS=True,
    EMAIL_USE_SSL=False,
)
def test_email_delivery_command_explains_gmail_authentication_failures():
    with patch(
        "django.core.mail.EmailMultiAlternatives.send",
        side_effect=smtplib.SMTPAuthenticationError(535, b"Bad credentials"),
    ):
        with pytest.raises(CommandError, match="Google App Password"):
            call_command("test_email_delivery", "owner@example.com")


@override_settings(
    EMAIL_BACKEND=SMTP_BACKEND,
    EMAIL_HOST="smtp.gmail.com",
    EMAIL_PORT=587,
    EMAIL_HOST_USER="",
    EMAIL_HOST_PASSWORD="",
    EMAIL_USE_TLS=True,
    EMAIL_USE_SSL=False,
)
def test_email_delivery_command_requires_gmail_credentials():
    with pytest.raises(CommandError, match="requires EMAIL_HOST_USER"):
        call_command("test_email_delivery", "owner@example.com")
