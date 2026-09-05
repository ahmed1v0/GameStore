from importlib import import_module

import pytest
from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import connection

from apps.accounts.models import AccountSecurity


@pytest.mark.django_db(transaction=True)
def test_existing_account_backfill_preserves_password_and_exempts_verification():
    user = get_user_model().objects.create_user(
        username="legacy", email="legacy@example.com", password="River!lantern-5839"
    )
    original_password = user.password
    AccountSecurity.objects.filter(user=user).delete()
    migration = import_module(
        "apps.accounts.migrations.0002_existing_accounts_and_email_uniqueness"
    )
    with connection.schema_editor() as editor:
        migration.prepare_accounts(apps, editor)
    user.refresh_from_db()
    assert user.password == original_password and user.email == "legacy@example.com"
    assert user.security.verification_required is False
    assert user.security.email_verified_at is None


@pytest.mark.django_db(transaction=True)
def test_migration_detects_duplicates_before_mutating_accounts():
    migration = import_module(
        "apps.accounts.migrations.0002_existing_accounts_and_email_uniqueness"
    )
    User = get_user_model()
    # Remove only the test database index and restore it before exiting this test.
    with connection.cursor() as cursor:
        cursor.execute("DROP INDEX accounts_user_email_ci_unique")
    try:
        first = User.objects.create_user(username="first", email="duplicate@example.com")
        second = User.objects.create_user(username="second", email="DUPLICATE@example.com")
        AccountSecurity.objects.all().delete()
        with connection.schema_editor() as editor, pytest.raises(RuntimeError, match="Duplicate"):
            migration.prepare_accounts(apps, editor)
        assert not AccountSecurity.objects.exists()
        assert User.objects.get(pk=first.pk).email == "duplicate@example.com"
        assert User.objects.get(pk=second.pk).email == "DUPLICATE@example.com"
    finally:
        User.objects.filter(username="second").delete()
        with connection.cursor() as cursor:
            cursor.execute(
                "CREATE UNIQUE INDEX accounts_user_email_ci_unique "
                "ON auth_user (LOWER(email)) WHERE email <> ''"
            )
