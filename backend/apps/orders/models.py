from decimal import Decimal
from uuid import uuid4

from django.conf import settings
from django.db import models

from apps.catalog.models import Product


class Order(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders"
    )
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="orders")
    reference = models.UUIDField(default=uuid4, unique=True, editable=False)
    # Legacy receipts have no key; new API purchases always supply one.
    idempotency_key = models.UUIDField(null=True, editable=False)
    product_title = models.CharField(max_length=255)
    unit_price = models.DecimalField(max_digits=14, decimal_places=3)
    product_location = models.CharField(max_length=2, choices=Product.Location)
    product_location_name = models.CharField(max_length=100)
    currency_code = models.CharField(max_length=3)
    currency_minor_unit = models.PositiveSmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "idempotency_key"], name="orders_user_idempotency_key_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(unit_price__gte=Decimal("0.00")),
                name="orders_order_unit_price_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(product_location__in=["JO", "SA"]),
                name="orders_order_location_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(currency_code__in=["JOD", "SAR"]),
                name="orders_order_currency_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(currency_minor_unit__lte=3),
                name="orders_order_currency_minor_unit_supported",
            ),
        ]

    def __str__(self) -> str:
        return f"Order {self.reference}: {self.product_title}"
