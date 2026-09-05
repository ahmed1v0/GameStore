from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from apps.catalog.models import Product
from apps.catalog.serializers import ProductWriteSerializer

pytestmark = pytest.mark.django_db


def product_payload(*, location: str, price: str) -> dict[str, str]:
    return {
        "title": "Regional item",
        "description": "A currency precision test item.",
        "price": price,
        "location": location,
    }


def test_jod_accepts_three_decimal_minor_unit() -> None:
    serializer = ProductWriteSerializer(data=product_payload(location="JO", price="1.234"))

    assert serializer.is_valid(), serializer.errors


def test_sar_rejects_precision_beyond_two_decimals() -> None:
    serializer = ProductWriteSerializer(data=product_payload(location="SA", price="1.234"))

    assert not serializer.is_valid()
    assert "SAR amounts support at most 2 decimal places." in str(serializer.errors["price"])


def test_domain_validation_applies_currency_precision_outside_api() -> None:
    product = Product(
        title="Invalid SAR item",
        description="Must not pass domain validation.",
        price=Decimal("1.234"),
        location_id="SA",
    )

    with pytest.raises(ValidationError, match="SAR amounts support at most 2 decimal places"):
        product.full_clean()
