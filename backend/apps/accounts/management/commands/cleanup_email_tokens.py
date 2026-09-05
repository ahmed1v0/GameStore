from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import EmailToken


class Command(BaseCommand):
    help = "Remove expired email verification and password reset tokens."

    def handle(self, *args, **options):
        count, _ = EmailToken.objects.filter(expires_at__lt=timezone.now()).delete()
        self.stdout.write(f"Removed {count} expired email tokens.")
