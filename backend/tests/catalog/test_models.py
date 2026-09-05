from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction

from apps.catalog.models import Product

pytestmark = pytest.mark.django_db


def test_product_accepts_supported_location() -> None:
    product = Product.objects.create(
        id=1,
        title="Jordan Pack",
        description="A regional digital item.",
        price=Decimal("10.00"),
        location_id=Product.Location.JORDAN,
    )

    assert product.location_id == "JO"
    assert product.location.currency_code == "JOD"


@pytest.mark.parametrize(
    ("field", "value"),
    [("price", Decimal("-0.01")), ("location_id", "US")],
)
def test_database_rejects_invalid_product_invariants(field: str, value: object) -> None:
    values = {
        "id": 1,
        "title": "Invalid product",
        "description": "This record should not persist.",
        "price": Decimal("10.00"),
        "location_id": "JO",
    }
    values[field] = value

    with pytest.raises(IntegrityError), transaction.atomic():
        Product.objects.create(**values)
