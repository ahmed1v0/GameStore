from django.db import migrations
from django.db.models import Count
from django.db.models.functions import Lower


def prepare_accounts(apps, schema_editor):
    User = apps.get_model("auth", "User")
    Security = apps.get_model("accounts", "AccountSecurity")
    Group = apps.get_model("auth", "Group")
    alias = schema_editor.connection.alias
    duplicates = list(
        User.objects.using(alias).exclude(email="").annotate(normalized=Lower("email"))
        .values("normalized").annotate(total=Count("id")).filter(total__gt=1)
    )
    if duplicates:
        raise RuntimeError(
            "Duplicate account emails prevent migration. Resolve case-insensitive duplicate "
            "nonempty emails in auth_user, then rerun migrate. No accounts were changed."
        )
    Security.objects.using(alias).bulk_create(
        [Security(user_id=pk, verification_required=False)
         for pk in User.objects.using(alias).values_list("pk", flat=True)], ignore_conflicts=True
    )
    Group.objects.using(alias).get_or_create(name="Application admins")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]
    operations = [
        migrations.RunPython(prepare_accounts, migrations.RunPython.noop),
        migrations.RunSQL(
            "CREATE UNIQUE INDEX accounts_user_email_ci_unique "
            "ON auth_user (LOWER(email)) WHERE email <> ''",
            "DROP INDEX accounts_user_email_ci_unique",
        ),
    ]
