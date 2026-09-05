import smtplib

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import EmailMultiAlternatives
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email


class Command(BaseCommand):
    help = "Send a non-sensitive test message through the configured email backend."

    def add_arguments(self, parser):
        parser.add_argument("recipient", help="Address that should receive the test message")

    def handle(self, *args, **options):
        recipient = options["recipient"].strip()
        try:
            validate_email(recipient)
        except ValidationError as exc:
            raise CommandError("Recipient must be a valid email address.") from exc

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
            sent = message.send(fail_silently=False)
        except smtplib.SMTPAuthenticationError as exc:
            raise CommandError(
                "SMTP authentication failed. For Gmail, enable 2-Step Verification and use "
                "a Google App Password in EMAIL_HOST_PASSWORD."
            ) from exc
        except (smtplib.SMTPException, OSError) as exc:
            raise CommandError(
                f"SMTP delivery failed ({type(exc).__name__}). Verify EMAIL_HOST, EMAIL_PORT, "
                "EMAIL_USE_TLS/EMAIL_USE_SSL, and network access."
            ) from exc

        if sent != 1:
            raise CommandError("The email backend did not accept the test message.")
        self.stdout.write(self.style.SUCCESS("The email backend accepted the test message."))
