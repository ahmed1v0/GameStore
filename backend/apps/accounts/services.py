import hashlib
import logging
import secrets
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.mail import EmailMultiAlternatives
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from .models import ADMIN_GROUP, AccountAudit, AccountSecurity, EmailToken
from .serializers import PasswordSerializer, role_for

logger = logging.getLogger(__name__)
GENERIC_EMAIL_MESSAGE = "If this account is eligible, an email will arrive shortly."


def fingerprint(password):
    return hashlib.sha256(password.encode()).hexdigest()


def send_account_email(user, purpose, *, invitation=False):
    if purpose == EmailToken.Purpose.VERIFY and not settings.EMAIL_VERIFICATION_ENABLED:
        return
    if invitation and purpose != EmailToken.Purpose.RESET:
        raise ValueError("Invitations must use a password-setup token.")

    # Lock the user before creating/consuming tokens throughout this app.
    with transaction.atomic():
        user = get_user_model().objects.select_for_update().get(pk=user.pk)
        if not user.is_active or not user.email:
            return
        if purpose == EmailToken.Purpose.VERIFY and user.security.email_verified_at:
            return

        raw = secrets.token_urlsafe(32)
        EmailToken.objects.filter(user=user, purpose=purpose, consumed_at=None).update(
            consumed_at=timezone.now()
        )
        EmailToken.objects.create(
            user=user,
            digest=fingerprint(raw),
            purpose=purpose,
            email=user.email,
            session_version=user.security.session_version,
            password_fingerprint=fingerprint(user.password),
            expires_at=timezone.now()
            + timedelta(
                seconds=settings.EMAIL_VERIFICATION_TIMEOUT
                if purpose == EmailToken.Purpose.VERIFY
                else settings.PASSWORD_RESET_TIMEOUT
            ),
        )

        route = "verify-email" if purpose == EmailToken.Purpose.VERIFY else "reset-password"
        query = {"token": raw}
        if invitation:
            query["invitation"] = "1"
        link = f"{settings.FRONTEND_URL.rstrip('/')}/{route}?{urlencode(query)}"

        if invitation:
            subject = "You're invited to Game Store"
            template = "invitation"
        else:
            subject = (
                "Verify your Game Store email"
                if purpose == EmailToken.Purpose.VERIFY
                else "Reset your Game Store password"
            )
            template = "verification" if purpose == EmailToken.Purpose.VERIFY else "password_reset"

        context = {"username": user.username, "action_url": link}
        body = render_to_string(f"accounts/email/{template}.txt", context)
        html = render_to_string(f"accounts/email/{template}.html", context)

        transaction.on_commit(lambda: deliver_email(subject, body, html, user.email))


def deliver_email(subject, body, html, recipient):
    try:
        email = EmailMultiAlternatives(subject, body, settings.DEFAULT_FROM_EMAIL, [recipient])
        email.attach_alternative(html, "text/html")
        email.send(fail_silently=False)
    except Exception:
        # Do not log SMTP exception text: it can contain credentials or message content.
        logger.error("Account email delivery failed; the user can request a resend.")


def signup(attrs):
    try:
        with transaction.atomic():
            user = get_user_model().objects.create_user(
                username=attrs["username"], email=attrs["email"], password=attrs["password"]
            )
            AccountSecurity.objects.filter(user=user).update(
                verification_required=settings.EMAIL_VERIFICATION_ENABLED
            )
            if settings.EMAIL_VERIFICATION_ENABLED:
                send_account_email(user, EmailToken.Purpose.VERIFY)
    except IntegrityError as exc:
        raise ValidationError({"detail": "This username or email is already in use."}) from exc


@transaction.atomic
def consume_email_token(raw, purpose, password_attrs=None):
    token = EmailToken.objects.filter(digest=fingerprint(raw), purpose=purpose).first()
    if token is None:
        raise ValidationError({"token": "This link is invalid or has expired. Request a new one."})
    user = get_user_model().objects.select_for_update().get(pk=token.user_id)
    token.refresh_from_db()
    security = user.security
    if (
        token.consumed_at
        or token.expires_at <= timezone.now()
        or not user.is_active
        or token.email != user.email
        or token.session_version != security.session_version
        or token.password_fingerprint != fingerprint(user.password)
    ):
        raise ValidationError({"token": "This link is invalid or has expired. Request a new one."})
    if purpose == EmailToken.Purpose.RESET:
        serializer = PasswordSerializer(data=password_attrs, context={"user": user})
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=["password"])
        security.session_version += 1
    else:
        security.email_verified_at = timezone.now()
    security.save()
    token.consumed_at = timezone.now()
    token.save(update_fields=["consumed_at"])


@transaction.atomic
def change_password(user_id, attrs):
    user = get_user_model().objects.select_for_update().get(pk=user_id)
    if not user.check_password(attrs["current_password"]):
        raise ValidationError({"current_password": "Your current password is incorrect."})
    user.set_password(attrs["password"])
    user.save(update_fields=["password"])
    security = user.security
    security.session_version += 1
    security.save(update_fields=["session_version"])


def _lock_admin_actor(actor_id):
    group = Group.objects.select_for_update().get(name=ADMIN_GROUP)
    users = get_user_model().objects
    actor = users.select_for_update().get(pk=actor_id)
    if not actor.is_active or role_for(actor) != "admin":
        raise PermissionDenied()
    return actor, group, users


def invite_account(actor_id, attrs):
    try:
        with transaction.atomic():
            actor, group, users = _lock_admin_actor(actor_id)
            generated_password = secrets.token_urlsafe(48)
            user = users.create_user(
                username=attrs["username"],
                email=attrs["email"],
                password=generated_password,
            )
            if attrs["role"] == "admin":
                user.groups.add(group)

            AccountAudit.objects.create(
                actor=actor,
                target=user,
                before={"exists": False},
                after={
                    "exists": True,
                    "role": attrs["role"],
                    "is_active": True,
                },
            )
            send_account_email(
                user,
                EmailToken.Purpose.RESET,
                invitation=True,
            )
    except IntegrityError as exc:
        raise ValidationError({"detail": "This username or email is already in use."}) from exc

    return (
        get_user_model()
        .objects.select_related("security")
        .prefetch_related("groups")
        .get(pk=user.pk)
    )


@transaction.atomic
def update_account(actor_id, target_id, attrs):
    actor, group, users = _lock_admin_actor(actor_id)
    try:
        target = users.select_for_update().get(pk=target_id)
    except get_user_model().DoesNotExist as exc:
        raise NotFound() from exc
    before = {"role": role_for(target), "is_active": target.is_active}
    after = {**before, **attrs}
    if target.is_superuser:
        raise ValidationError("Superusers cannot be changed here.")
    if actor.pk == target.pk and (after["role"] != "admin" or not after["is_active"]):
        raise ValidationError("You cannot demote or deactivate your own account.")
    if before["role"] == "admin" and (after["role"] != "admin" or not after["is_active"]):
        remaining = (
            users.filter(is_active=True)
            .exclude(pk=target.pk)
            .filter(Q(is_superuser=True) | Q(groups__name=ADMIN_GROUP))
            .exists()
        )
        if not remaining:
            raise ValidationError("At least one active administrator must remain.")
    if before != after:
        if after["role"] == "admin":
            target.groups.add(group)
        else:
            target.groups.remove(group)
        target.is_active = after["is_active"]
        target.save(update_fields=["is_active"])
        AccountAudit.objects.create(actor=actor, target=target, before=before, after=after)
    return users.select_related("security").prefetch_related("groups").get(pk=target.pk)
