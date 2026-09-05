import re

import pytest
from django.contrib.auth.models import Group
from django.core import mail
from rest_framework.test import APIClient

from apps.accounts.authentication import issue_refresh
from apps.accounts.models import ADMIN_GROUP, AccountAudit, EmailToken

pytestmark = pytest.mark.django_db

PASSWORD = "River!lantern-5839"
NEW_PASSWORD = "Cloud!meadow-9264"


def authorized(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issue_refresh(user).access_token}")
    return client


def invitation_token():
    return re.search(r"token=([\w-]+)", mail.outbox[-1].body).group(1)


def test_admin_invitation_creates_account_and_password_setup_link(
    django_user_model,
    django_capture_on_commit_callbacks,
):
    admin = django_user_model.objects.create_user(
        username="manager",
        email="manager@example.com",
        password=PASSWORD,
    )
    admin.groups.add(Group.objects.get_or_create(name=ADMIN_GROUP)[0])

    with django_capture_on_commit_callbacks(execute=True):
        response = authorized(admin).post(
            "/api/v1/admin/users/invitations",
            {
                "username": "invited-user",
                "email": "INVITED@example.com",
                "role": "admin",
            },
            format="json",
        )

    assert response.status_code == 201
    assert response.data["role"] == "admin"
    assert response.data["email"] == "invited@example.com"

    invited = django_user_model.objects.get(username="invited-user")
    assert invited.has_usable_password()
    assert not invited.is_staff and not invited.is_superuser
    assert invited.groups.filter(name=ADMIN_GROUP).exists()
    assert invited.security.verification_required is False

    audit = AccountAudit.objects.get(target=invited)
    assert audit.actor == admin
    assert audit.before == {"exists": False}
    assert audit.after == {"exists": True, "role": "admin", "is_active": True}

    assert len(mail.outbox) == 1
    assert mail.outbox[0].subject == "You're invited to Game Store"
    assert "invitation=1" in mail.outbox[0].body
    token = invitation_token()
    assert EmailToken.objects.get(user=invited).purpose == EmailToken.Purpose.RESET

    reset = APIClient().post(
        "/api/v1/auth/reset-password",
        {
            "token": token,
            "password": NEW_PASSWORD,
            "password_confirm": NEW_PASSWORD,
        },
        format="json",
    )
    assert reset.status_code == 200
    invited.refresh_from_db()
    assert invited.check_password(NEW_PASSWORD)

    login = APIClient().post(
        "/api/v1/auth/login",
        {"username": invited.username, "password": NEW_PASSWORD},
        format="json",
    )
    assert login.status_code == 200


def test_non_admin_cannot_invite_users(django_user_model):
    user = django_user_model.objects.create_user(
        username="customer",
        email="customer@example.com",
        password=PASSWORD,
    )
    response = authorized(user).post(
        "/api/v1/admin/users/invitations",
        {
            "username": "blocked",
            "email": "blocked@example.com",
            "role": "user",
        },
        format="json",
    )
    assert response.status_code == 403
    assert not django_user_model.objects.filter(username="blocked").exists()
