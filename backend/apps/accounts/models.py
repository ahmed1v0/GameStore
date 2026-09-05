from django.conf import settings
from django.db import models

ADMIN_GROUP = "Application admins"


class AccountSecurity(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="security"
    )
    verification_required = models.BooleanField(default=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    session_version = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"Account security #{self.user_id}"


class EmailToken(models.Model):
    class Purpose(models.TextChoices):
        VERIFY = "verify", "Email verification"
        RESET = "reset", "Password reset"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    digest = models.CharField(max_length=64, unique=True)
    purpose = models.CharField(max_length=8, choices=Purpose.choices)
    email = models.EmailField()
    session_version = models.PositiveIntegerField()
    password_fingerprint = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.purpose} token #{self.pk}"


class AccountAudit(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="account_changes_made"
    )
    target = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="account_changes_received"
    )
    before = models.JSONField()
    after = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"Account change #{self.pk}"
