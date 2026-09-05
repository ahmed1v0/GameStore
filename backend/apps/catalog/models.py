from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models

from apps.catalog.money import exceeds_minor_unit, precision_error


class RegionCode(models.TextChoices):
    JORDAN = "JO", "Jordan"
    SAUDI_ARABIA = "SA", "Saudi Arabia"


class Region(models.Model):
    code = models.CharField(primary_key=True, max_length=2, choices=RegionCode.choices)
    name = models.CharField(max_length=100)
    currency_code = models.CharField(max_length=3)
    minor_unit = models.PositiveSmallIntegerField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(minor_unit__lte=3),
                name="catalog_region_minor_unit_supported",
            )
        ]

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    Location = RegionCode

    id = models.BigAutoField(primary_key=True)
    title = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(max_digits=14, decimal_places=3)
    location = models.ForeignKey(
        Region,
        to_field="code",
        db_column="location",
        on_delete=models.PROTECT,
        related_name="products",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["location", "id"], name="catalog_location_id_idx")]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__gte=Decimal("0.00")),
                name="catalog_product_price_non_negative",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        if self.price is None or not self.location_id:
            return
        try:
            region = self.location
        except Region.DoesNotExist:
            return
        if exceeds_minor_unit(self.price, region.minor_unit):
            raise ValidationError(
                {"price": precision_error(region.currency_code, region.minor_unit)}
            )

    def __str__(self) -> str:
        return self.title
