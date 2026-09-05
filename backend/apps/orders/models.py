from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.catalog.models import Product


class Order(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders"
    )
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="orders")
    product_title = models.CharField(max_length=255)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    product_location = models.CharField(max_length=2, choices=Product.Location)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(unit_price__gte=Decimal("0.00")),
                name="orders_order_unit_price_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(product_location__in=["JO", "SA"]),
                name="orders_order_location_valid",
            ),
        ]

    def __str__(self) -> str:
        return f"Order {self.pk}: {self.product_title}"
