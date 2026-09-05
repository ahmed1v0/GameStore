import smtplib

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import EmailMultiAlternatives, get_connection
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email

SMTP_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
GMAIL_SMTP_HOSTS = {"smtp.gmail.com", "smtp.googlemail.com"}


class Command(BaseCommand):
    help = "Send a non-sensitive test message through the configured SMTP backend."

    def add_arguments(self, parser):
        parser.add_argument("recipient", nargs="?", help="Address to receive the test message")
        parser.add_argument(
            "--check-only", action="store_true", help="Check SMTP login without sending email"
        )

    def handle(self, *args, **options):
        recipient = (options["recipient"] or "").strip()
        if not options["check_only"]:
            try:
                validate_email(recipient)
            except ValidationError as exc:
                raise CommandError("Recipient must be a valid email address.") from exc

        self._print_effective_configuration()
        self._validate_smtp_configuration()

        message = EmailMultiAlternatives(
            "Game Store email delivery test",
            "Your Game Store email configuration is working.",
            settings.DEFAULT_FROM_EMAIL,
            [recipient],
        )
        message.attach_alternative(
            "<p>Your <strong>Game Store</strong> email configuration is working.</p>",
            "text/html",
        )

        try:
            if options["check_only"]:
                with get_connection():
                    pass  # Opening the SMTP backend connects, negotiates TLS and authenticates.
                self.stdout.write(
                    self.style.SUCCESS("SMTP connection and login succeeded. No email sent.")
                )
                return
            sent = message.send(fail_silently=False)
        except smtplib.SMTPAuthenticationError as exc:
            raise CommandError(
                f"SMTP authentication failed (code {exc.smtp_code}). For Gmail, enable "
                "2-Step Verification and use a new Google App Password belonging to "
                "EMAIL_HOST_USER in EMAIL_HOST_PASSWORD. Restart the terminal and backend "
                "after updating backend/.env."
            ) from None
        except smtplib.SMTPSenderRefused as exc:
            raise CommandError(
                "SMTP rejected DEFAULT_FROM_EMAIL. Use the authenticated Gmail address as the "
                "sender, or configure an authorized sender with your provider."
            ) from exc
        except smtplib.SMTPRecipientsRefused as exc:
            raise CommandError("SMTP rejected the recipient address.") from exc
        except (smtplib.SMTPException, OSError) as exc:
            raise CommandError(
                f"SMTP delivery failed ({type(exc).__name__}). Verify EMAIL_HOST, EMAIL_PORT, "
                "EMAIL_USE_TLS/EMAIL_USE_SSL, and network access."
            ) from exc

        if sent != 1:
            raise CommandError("The SMTP backend did not accept the test message.")
        self.stdout.write(self.style.SUCCESS("SMTP accepted the test message for delivery."))

    def _print_effective_configuration(self):
        self.stdout.write(f"Email backend: {settings.EMAIL_BACKEND}")
        self.stdout.write(f"SMTP host: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}")
        self.stdout.write(f"SMTP user: {settings.EMAIL_HOST_USER or '<empty>'}")
        self.stdout.write(f"Transport: TLS={settings.EMAIL_USE_TLS}, SSL={settings.EMAIL_USE_SSL}")
        self.stdout.write(f"From: {settings.DEFAULT_FROM_EMAIL}")
        password_state = "<configured>" if settings.EMAIL_HOST_PASSWORD else "<empty>"
        self.stdout.write(f"SMTP password: {password_state}")

    def _validate_smtp_configuration(self):
        if settings.EMAIL_BACKEND != SMTP_BACKEND:
            raise CommandError(
                "Real email delivery is disabled because EMAIL_BACKEND is not Django's SMTP "
                "backend. Set EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend."
            )

        if not settings.EMAIL_HOST:
            raise CommandError("EMAIL_HOST is empty.")

        if settings.EMAIL_HOST.lower() in GMAIL_SMTP_HOSTS:
            if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
                raise CommandError(
                    "Gmail SMTP requires EMAIL_HOST_USER and a Google App Password in "
                    "EMAIL_HOST_PASSWORD."
                )
            valid_transport = (
                settings.EMAIL_PORT == 587 and settings.EMAIL_USE_TLS and not settings.EMAIL_USE_SSL
            ) or (
                settings.EMAIL_PORT == 465 and settings.EMAIL_USE_SSL and not settings.EMAIL_USE_TLS
            )
            if not valid_transport:
                raise CommandError("Gmail SMTP requires port 587 with TLS or port 465 with SSL.")
