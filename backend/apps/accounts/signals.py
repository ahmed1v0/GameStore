from django.contrib.auth import get_user_model
from django.db.models import F
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import AccountSecurity


@receiver(pre_save, sender=get_user_model())
def invalidate_disabled_account(sender, instance, **kwargs):
    if (
        instance.pk
        and not instance.is_active
        and sender.objects.filter(pk=instance.pk, is_active=True).exists()
    ):
        AccountSecurity.objects.filter(user_id=instance.pk).update(
            session_version=F("session_version") + 1
        )


@receiver(post_save, sender=get_user_model())
def ensure_security(sender, instance, created, raw=False, **kwargs):
    if created and not raw:
        # Operator-created accounts (including createsuperuser) are trusted.
        # Public signup explicitly switches verification_required on in its transaction.
        AccountSecurity.objects.get_or_create(
            user=instance, defaults={"verification_required": False}
        )
