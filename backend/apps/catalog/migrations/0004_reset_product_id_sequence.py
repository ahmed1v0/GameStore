from django.db import migrations
from django.core.management.color import no_style


def reset_product_sequence(apps, schema_editor):
    product_model = apps.get_model("catalog", "Product")
    connection = schema_editor.connection
    for sql in connection.ops.sequence_reset_sql(no_style(), [product_model]):
        schema_editor.execute(sql)


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0003_alter_product_id"),
    ]

    operations = [
        migrations.RunPython(reset_product_sequence, migrations.RunPython.noop),
    ]
