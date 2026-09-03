from decimal import Decimal

from django.db import models


class Product(models.Model):
    class Location(models.TextChoices):
        JORDAN = "JO", "Jordan"
        SAUDI_ARABIA = "SA", "Saudi Arabia"

    id = models.PositiveBigIntegerField(primary_key=True)
    title = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(max_digits=12, decimal_places=2)
    location = models.CharField(max_length=2, choices=Location, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__gte=Decimal("0.00")),
                name="catalog_product_price_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(location__in=["JO", "SA"]),
                name="catalog_product_location_valid",
            ),
        ]

    def __str__(self) -> str:
        return self.title
