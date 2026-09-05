import uuid
from django.db import migrations, models


REGION_SNAPSHOTS = {
    "JO": ("Jordan", "JOD", 3),
    "SA": ("Saudi Arabia", "SAR", 2),
}


def backfill_receipt_metadata(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    orders = []
    for order in Order.objects.all().iterator(chunk_size=500):
        location_name, currency_code, minor_unit = REGION_SNAPSHOTS[order.product_location]
        order.reference = uuid.uuid4()
        order.product_location_name = location_name
        order.currency_code = currency_code
        order.currency_minor_unit = minor_unit
        orders.append(order)
        if len(orders) == 500:
            Order.objects.bulk_update(
                orders,
                ["reference", "product_location_name", "currency_code", "currency_minor_unit"],
            )
            orders.clear()
    if orders:
        Order.objects.bulk_update(
            orders,
            ["reference", "product_location_name", "currency_code", "currency_minor_unit"],
        )


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0006_currency_minor_units"),
        ("orders", "0002_purchase_idempotency"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="currency_code",
            field=models.CharField(max_length=3, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="currency_minor_unit",
            field=models.PositiveSmallIntegerField(null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="product_location_name",
            field=models.CharField(max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="reference",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.AlterField(
            model_name="order",
            name="unit_price",
            field=models.DecimalField(decimal_places=3, max_digits=14),
        ),
        migrations.RunPython(backfill_receipt_metadata, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="order",
            name="currency_code",
            field=models.CharField(max_length=3),
        ),
        migrations.AlterField(
            model_name="order",
            name="currency_minor_unit",
            field=models.PositiveSmallIntegerField(),
        ),
        migrations.AlterField(
            model_name="order",
            name="product_location_name",
            field=models.CharField(max_length=100),
        ),
        migrations.AlterField(
            model_name="order",
            name="reference",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AddConstraint(
            model_name="order",
            constraint=models.CheckConstraint(
                condition=models.Q(("currency_code__in", ["JOD", "SAR"])),
                name="orders_order_currency_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="order",
            constraint=models.CheckConstraint(
                condition=models.Q(("currency_minor_unit__lte", 3)),
                name="orders_order_currency_minor_unit_supported",
            ),
        ),
    ]
