import re
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

import pytest
from django.conf import settings
from django.contrib.auth.models import Group
from django.core import mail
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.accounts import services
from apps.accounts.authentication import issue_refresh
from apps.accounts.models import ADMIN_GROUP, AccountAudit, EmailToken

pytestmark = pytest.mark.django_db
PASSWORD = "River!lantern-5839"
NEW_PASSWORD = "Cloud!meadow-9264"


@pytest.fixture(autouse=True)
def enable_verification(settings):
    settings.EMAIL_VERIFICATION_ENABLED = True


@pytest.fixture
def post(django_capture_on_commit_callbacks):
    def call(client, path, body=None, **kwargs):
        with django_capture_on_commit_callbacks(execute=True):
            return client.post(f"/api/v1/{path}", body or {}, format="json", **kwargs)

    return call


@pytest.fixture
def account(django_user_model):
    return django_user_model.objects.create_user(
        username="customer", email="customer@example.com", password=PASSWORD
    )


@pytest.fixture
def admin_user(django_user_model):
    user = django_user_model.objects.create_user(username="manager", password=PASSWORD)
    user.groups.add(Group.objects.get_or_create(name=ADMIN_GROUP)[0])
    return user


def authorized(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issue_refresh(user).access_token}")
    return client


def token_from_email():
    return re.search(r"token=([\w-]+)", mail.outbox[-1].body).group(1)


def signup_body(**overrides):
    return {
        "username": "new-user",
        "email": "new@example.com",
        "password": PASSWORD,
        "password_confirm": PASSWORD,
        **overrides,
    }


def test_signup_without_verification(api_client, post, django_user_model, settings):
    settings.EMAIL_VERIFICATION_ENABLED = False
    response = post(api_client, "auth/signup", signup_body())
    assert response.status_code == 201
    assert response.data == {
        "detail": "Account created. You can now sign in.",
        "verification_required": False,
    }
    user = django_user_model.objects.get(username="new-user")
    assert not user.security.verification_required
    assert user.security.email_verified_at is None
    assert not mail.outbox and not EmailToken.objects.exists()
    login = post(api_client, "auth/login", {"username": user.username, "password": PASSWORD})
    assert login.status_code == 200
    assert login.data["user"]["email_verification_enabled"] is False
    assert login.data["user"]["email_verified"] is False
    # Accounts registered while verification is off retain their exemption after enabling it.
    settings.EMAIL_VERIFICATION_ENABLED = True
    assert post(api_client, "auth/refresh").status_code == 200


def test_pending_account_can_authenticate_when_verification_disabled(
    api_client, post, account, settings
):
    security = account.security
    security.verification_required = True
    security.save()
    settings.EMAIL_VERIFICATION_ENABLED = False
    login = post(api_client, "auth/login", {"username": account.username, "password": PASSWORD})
    assert login.status_code == 200
    assert login.data["user"]["verification_required"] is False
    assert post(api_client, "auth/refresh").status_code == 200
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    assert client.get("/api/v1/auth/me").status_code == 200
    security.refresh_from_db()
    assert security.verification_required and security.email_verified_at is None
    settings.EMAIL_VERIFICATION_ENABLED = True
    assert client.get("/api/v1/auth/me").status_code == 401
    assert post(api_client, "auth/refresh").status_code == 401


def test_disabled_verification_preserves_password_recovery(api_client, post, account, settings):
    settings.EMAIL_VERIFICATION_ENABLED = False
    assert api_client.get("/api/v1/auth/csrf").data["email_verification_enabled"] is False
    known = post(api_client, "auth/resend-verification", {"email": account.email})
    missing = post(api_client, "auth/resend-verification", {"email": "nobody@example.com"})
    assert known.data == missing.data
    assert not mail.outbox and not EmailToken.objects.exists()
    post(api_client, "auth/forgot-password", {"email": account.email})
    token = token_from_email()
    assert (
        post(
            api_client,
            "auth/reset-password",
            {
                "token": token,
                "password": NEW_PASSWORD,
                "password_confirm": NEW_PASSWORD,
            },
        ).status_code
        == 200
    )
    assert (
        post(
            api_client,
            "auth/login",
            {
                "username": account.username,
                "password": NEW_PASSWORD,
            },
        ).status_code
        == 200
    )


def test_disabling_verification_does_not_allow_disabled_accounts(
    api_client, post, account, settings
):
    settings.EMAIL_VERIFICATION_ENABLED = False
    token = issue_refresh(account)
    api_client.cookies[settings.AUTH_REFRESH_COOKIE] = str(token)
    account.is_active = False
    account.save(update_fields=["is_active"])
    assert (
        post(
            api_client,
            "auth/login",
            {
                "username": account.username,
                "password": PASSWORD,
            },
        ).status_code
        == 401
    )
    assert post(api_client, "auth/refresh").status_code == 401


def test_signup_verify_login_and_replay(api_client, post, django_user_model):
    response = post(api_client, "auth/signup", signup_body(email="NEW@Example.com"))
    assert response.status_code == 201
    user = django_user_model.objects.get(username="new-user")
    assert user.email == "new@example.com"
    assert user.check_password(PASSWORD)
    assert not user.is_staff and not user.is_superuser and not user.groups.exists()
    assert user.security.verification_required and not user.security.email_verified_at
    token = token_from_email()
    assert EmailToken.objects.get(user=user).digest != token
    assert (
        post(
            api_client, "auth/login", {"username": user.username, "password": PASSWORD}
        ).status_code
        == 401
    )
    assert post(api_client, "auth/verify-email", {"token": token}).status_code == 200
    assert post(api_client, "auth/verify-email", {"token": token}).status_code == 400
    login = post(api_client, "auth/login", {"username": user.username, "password": PASSWORD})
    assert login.status_code == 200
    assert login.data["user"]["email_verified"] is True
    assert set(login.data) == {"access", "user"}


@pytest.mark.parametrize(
    "overrides",
    [
        {"password_confirm": "different"},
        {"password": "12345678", "password_confirm": "12345678"},
        {"email": "invalid"},
        {"username": "bad name"},
        {"role": "admin"},
        {"is_superuser": True},
        {"is_staff": True},
        {"verification_required": False},
    ],
)
def test_signup_validation(api_client, post, overrides, django_user_model):
    assert post(api_client, "auth/signup", signup_body(**overrides)).status_code == 400
    assert not django_user_model.objects.filter(username="new-user").exists()


def test_duplicate_email_username_and_database_constraint(
    api_client, post, account, django_user_model
):
    assert (
        post(api_client, "auth/signup", signup_body(email="CUSTOMER@EXAMPLE.COM")).status_code
        == 400
    )
    assert (
        post(api_client, "auth/signup", signup_body(username=account.username)).status_code == 400
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        django_user_model.objects.create_user(username="other", email="CUSTOMER@EXAMPLE.COM")
    django_user_model.objects.create_user(username="blank-one")
    django_user_model.objects.create_user(username="blank-two")


def test_email_requests_do_not_disclose_accounts(api_client, post, account):
    known = post(api_client, "auth/forgot-password", {"email": account.email})
    assert len(mail.outbox) == 1
    missing = post(api_client, "auth/forgot-password", {"email": "nobody@example.com"})
    account.is_active = False
    account.save()
    disabled = post(api_client, "auth/forgot-password", {"email": account.email})
    assert known.status_code == missing.status_code == disabled.status_code == 200
    assert known.data == missing.data == disabled.data
    assert len(mail.outbox) == 1


def test_resend_invalidates_previous_link(api_client, post):
    post(api_client, "auth/signup", signup_body())
    old = token_from_email()
    post(api_client, "auth/resend-verification", {"email": "new@example.com"})
    new = token_from_email()
    assert old != new
    assert post(api_client, "auth/verify-email", {"token": old}).status_code == 400
    assert post(api_client, "auth/verify-email", {"token": new}).status_code == 200


def test_expired_and_wrong_purpose_tokens(api_client, post, account):
    post(api_client, "auth/forgot-password", {"email": account.email})
    raw = token_from_email()
    assert post(api_client, "auth/verify-email", {"token": raw}).status_code == 400
    EmailToken.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    assert (
        post(
            api_client,
            "auth/reset-password",
            {"token": raw, "password": NEW_PASSWORD, "password_confirm": NEW_PASSWORD},
        ).status_code
        == 400
    )


def test_verification_cannot_reactivate_disabled_account(api_client, post, django_user_model):
    post(api_client, "auth/signup", signup_body())
    raw = token_from_email()
    user = django_user_model.objects.get(username="new-user")
    user.is_active = False
    user.save()
    assert post(api_client, "auth/verify-email", {"token": raw}).status_code == 400
    user.refresh_from_db()
    assert not user.is_active and user.security.email_verified_at is None


def test_password_reset_invalidates_all_sessions_and_token(api_client, post, account):
    bearer = authorized(account)
    login = post(api_client, "auth/login", {"username": account.username, "password": PASSWORD})
    old_refresh = api_client.cookies[settings.AUTH_REFRESH_COOKIE].value
    assert login.status_code == 200
    post(api_client, "auth/forgot-password", {"email": account.email})
    body = {"token": token_from_email(), "password": NEW_PASSWORD, "password_confirm": NEW_PASSWORD}
    assert post(api_client, "auth/reset-password", body).status_code == 200
    assert post(api_client, "auth/reset-password", body).status_code == 400
    assert bearer.get("/api/v1/auth/me").status_code == 401
    api_client.cookies[settings.AUTH_REFRESH_COOKIE] = old_refresh
    assert post(api_client, "auth/refresh").status_code == 401
    assert (
        post(
            api_client, "auth/login", {"username": account.username, "password": PASSWORD}
        ).status_code
        == 401
    )
    assert (
        post(
            api_client, "auth/login", {"username": account.username, "password": NEW_PASSWORD}
        ).status_code
        == 200
    )


def test_change_password_requires_current_and_invalidates_sessions(post, account):
    client = authorized(account)
    body = {"current_password": "wrong", "password": NEW_PASSWORD, "password_confirm": NEW_PASSWORD}
    assert post(client, "auth/change-password", body).status_code == 400
    body["current_password"] = PASSWORD
    assert post(client, "auth/change-password", body).status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401


def test_admin_password_change_also_invalidates_refresh(api_client, post, account):
    post(api_client, "auth/login", {"username": account.username, "password": PASSWORD})
    account.set_password(NEW_PASSWORD)
    account.save()
    assert post(api_client, "auth/refresh").status_code == 401


def test_cookie_attributes_rotation_replay_and_logout(api_client, post, account, settings):
    settings.AUTH_COOKIE_SECURE = True
    login = post(api_client, "auth/login", {"username": account.username, "password": PASSWORD})
    cookie = login.cookies[settings.AUTH_REFRESH_COOKIE]
    assert cookie["httponly"] and cookie["secure"]
    assert cookie["path"] == "/api/v1/auth" and cookie["samesite"] == "Lax"
    assert not cookie["domain"] and cookie["max-age"] == 86400
    first = cookie.value
    assert post(api_client, "auth/refresh").status_code == 200
    second = api_client.cookies[settings.AUTH_REFRESH_COOKIE].value
    assert first != second
    attacker = APIClient()
    attacker.cookies[settings.AUTH_REFRESH_COOKIE] = first
    assert post(attacker, "auth/refresh").status_code == 401
    assert post(api_client, "auth/logout").status_code == 200
    attacker.cookies[settings.AUTH_REFRESH_COOKIE] = second
    assert post(attacker, "auth/refresh").status_code == 401
    assert post(api_client, "auth/logout").status_code == 200


def test_csrf_required_for_auth_posts(post, account):
    client = APIClient(enforce_csrf_checks=True)
    body = {"username": account.username, "password": PASSWORD}
    assert post(client, "auth/login", body).status_code == 403
    token = client.get("/api/v1/auth/csrf").data["csrfToken"]
    assert (
        post(
            client, "auth/login", body, HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="https://evil.example"
        ).status_code
        == 403
    )
    assert post(client, "auth/login", body, HTTP_X_CSRFTOKEN=token).status_code == 200
    assert post(client, "auth/refresh").status_code == 403
    assert post(client, "auth/logout").status_code == 403
    new_token = client.get("/api/v1/auth/csrf").data["csrfToken"]
    assert post(client, "auth/refresh", HTTP_X_CSRFTOKEN=new_token).status_code == 200


@pytest.mark.parametrize(
    "path", ["signup", "verify-email", "resend-verification", "forgot-password", "reset-password"]
)
def test_all_public_auth_writes_require_csrf(path):
    assert APIClient(enforce_csrf_checks=True).post(f"/api/v1/auth/{path}", {}).status_code == 403


def test_throttles_email_requests(api_client, post):
    for _ in range(3):
        assert (
            post(api_client, "auth/forgot-password", {"email": "absent@example.com"}).status_code
            == 200
        )
    assert (
        post(api_client, "auth/forgot-password", {"email": "ABSENT@example.com"}).status_code == 429
    )


def test_delivery_failure_is_generic_and_does_not_log_secrets(api_client, post, account, caplog):
    with patch(
        "apps.accounts.services.send_mail", side_effect=RuntimeError("secret SMTP password")
    ):
        response = post(api_client, "auth/forgot-password", {"email": account.email})
    assert response.status_code == 200
    assert "delivery failed" in caplog.text
    assert "secret SMTP password" not in caplog.text


def test_users_cannot_manage_roles(account, api_client):
    client = authorized(account)
    assert api_client.get("/api/v1/admin/users").status_code == 401
    assert client.get("/api/v1/admin/users").status_code == 403
    assert (
        client.patch(
            f"/api/v1/admin/users/{account.pk}", {"role": "admin"}, format="json"
        ).status_code
        == 403
    )


def test_admin_role_updates_and_audit(admin_user, account):
    client = authorized(admin_user)
    response = client.patch(f"/api/v1/admin/users/{account.pk}", {"role": "admin"}, format="json")
    assert response.status_code == 200 and response.data["role"] == "admin"
    account.refresh_from_db()
    assert not account.is_staff and not account.is_superuser
    audit = AccountAudit.objects.get()
    assert audit.actor == admin_user and audit.target == account
    assert audit.before == {"role": "user", "is_active": True}
    assert audit.after == {"role": "admin", "is_active": True}
    target_client = authorized(account)
    assert target_client.get("/api/v1/admin/users").status_code == 200
    client.patch(f"/api/v1/admin/users/{account.pk}", {"role": "user"}, format="json")
    assert target_client.get("/api/v1/admin/users").status_code == 403


def test_deactivation_stays_revoked_after_reactivation(admin_user, account):
    client = authorized(admin_user)
    target_client = authorized(account)
    url = f"/api/v1/admin/users/{account.pk}"
    assert client.patch(url, {"is_active": False}, format="json").status_code == 200
    assert target_client.get("/api/v1/auth/me").status_code == 401
    assert client.patch(url, {"is_active": True}, format="json").status_code == 200
    assert target_client.get("/api/v1/auth/me").status_code == 401


def test_self_superuser_and_unknown_field_protection(admin_user, django_user_model):
    client = authorized(admin_user)
    url = f"/api/v1/admin/users/{admin_user.pk}"
    for body in [
        {"role": "user"},
        {"is_active": False},
        {"is_staff": True},
        {"email": "evil@example.com"},
    ]:
        assert client.patch(url, body, format="json").status_code == 400
    root = django_user_model.objects.create_superuser("root", "root@example.com", PASSWORD)
    assert (
        client.patch(
            f"/api/v1/admin/users/{root.pk}", {"is_active": False}, format="json"
        ).status_code
        == 400
    )
    assert authorized(root).get("/api/v1/admin/users").status_code == 200


def test_admin_search_pagination_and_exemption(admin_user, account):
    response = authorized(admin_user).get("/api/v1/admin/users?search=CUSTOMER")
    assert response.status_code == 200 and response.data["count"] == 1
    assert response.data["results"][0]["id"] == account.pk
    assert response.data["results"][0]["email_verified"] is False
    assert response.data["results"][0]["verification_required"] is False


def test_password_change_requires_csrf(account):
    client = APIClient(enforce_csrf_checks=True)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issue_refresh(account).access_token}")
    assert client.post("/api/v1/auth/change-password", {}).status_code == 403


def test_verification_timeout(api_client, post):
    post(api_client, "auth/signup", signup_body())
    raw = token_from_email()
    EmailToken.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    assert post(api_client, "auth/verify-email", {"token": raw}).status_code == 400


def test_cleanup_retains_valid_tokens_and_audits(api_client, post, account):
    from django.core.management import call_command

    post(api_client, "auth/forgot-password", {"email": account.email})
    call_command("cleanup_email_tokens")
    assert EmailToken.objects.count() == 1
    EmailToken.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    call_command("cleanup_email_tokens")
    assert EmailToken.objects.count() == 0


@pytest.mark.django_db(transaction=True)
def test_concurrent_signup_unique_email(django_user_model):
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock race requires PostgreSQL")
    barrier = Barrier(2)

    def create(name):
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            services.signup(signup_body(username=name))
            return "created"
        except ValidationError:
            return "conflict"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(create, ["race-one", "race-two"]))
    assert sorted(results) == ["conflict", "created"]
    assert django_user_model.objects.filter(email="new@example.com").count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_refresh_is_single_use(account):
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock race requires PostgreSQL")
    raw = str(issue_refresh(account))
    barrier = Barrier(2)

    def refresh(_):
        close_old_connections()
        try:
            client = APIClient()
            client.cookies[settings.AUTH_REFRESH_COOKIE] = raw
            barrier.wait(timeout=10)
            return client.post("/api/v1/auth/refresh").status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(refresh, range(2))) == [200, 401]


@pytest.mark.django_db(transaction=True)
def test_concurrent_admin_demotions_leave_an_admin(admin_user, account):
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock race requires PostgreSQL")
    account.groups.add(Group.objects.get(name=ADMIN_GROUP))
    barrier = Barrier(2)

    def demote(pair):
        close_old_connections()
        try:
            client = authorized(pair[0])
            barrier.wait(timeout=10)
            return client.patch(
                f"/api/v1/admin/users/{pair[1].pk}", {"role": "user"}, format="json"
            ).status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(demote, [(admin_user, account), (account, admin_user)]))
    assert sorted(results) == [200, 403]
    assert Group.objects.get(name=ADMIN_GROUP).user_set.filter(is_active=True).count() == 1
