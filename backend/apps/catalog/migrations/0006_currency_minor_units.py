from django.db import migrations, models


def set_minor_units(apps, schema_editor):
    Region = apps.get_model("catalog", "Region")
    Region.objects.filter(code="JO").update(minor_unit=3)
    Region.objects.filter(code="SA").update(minor_unit=2)


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0005_region_reference_data"),
    ]

    operations = [
        migrations.AddField(
            model_name="region",
            name="minor_unit",
            field=models.PositiveSmallIntegerField(default=2),
            preserve_default=False,
        ),
        migrations.RunPython(set_minor_units, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="region",
            constraint=models.CheckConstraint(
                condition=models.Q(("minor_unit__lte", 3)),
                name="catalog_region_minor_unit_supported",
            ),
        ),
        migrations.AlterField(
            model_name="product",
            name="price",
            field=models.DecimalField(decimal_places=3, max_digits=14),
        ),
    ]
