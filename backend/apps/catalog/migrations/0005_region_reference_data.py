import django.db.models.deletion
from django.db import migrations, models


REGIONS = (
    ("JO", "Jordan", "JOD"),
    ("SA", "Saudi Arabia", "SAR"),
)


def seed_regions(apps, schema_editor):
    Region = apps.get_model("catalog", "Region")
    Region.objects.bulk_create(
        [
            Region(code=code, name=name, currency_code=currency_code, is_active=True)
            for code, name, currency_code in REGIONS
        ],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0004_reset_product_id_sequence"),
    ]

    operations = [
        migrations.CreateModel(
            name="Region",
            fields=[
                (
                    "code",
                    models.CharField(
                        choices=[("JO", "Jordan"), ("SA", "Saudi Arabia")],
                        max_length=2,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("name", models.CharField(max_length=100)),
                ("currency_code", models.CharField(max_length=3)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={"ordering": ["code"]},
        ),
        migrations.RunPython(seed_regions, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="product",
            name="catalog_product_location_valid",
        ),
        migrations.AlterField(
            model_name="product",
            name="location",
            field=models.ForeignKey(
                db_column="location",
                on_delete=django.db.models.deletion.PROTECT,
                related_name="products",
                to="catalog.region",
            ),
        ),
    ]
