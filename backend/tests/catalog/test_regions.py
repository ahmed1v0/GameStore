import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db


def test_returns_normalized_region_lookup(authenticated_client) -> None:
    response = authenticated_client.get(reverse("region-list"))

    assert response.status_code == 200
    assert response.data == [
        {"code": "JO", "name": "Jordan", "currency_code": "JOD"},
        {"code": "SA", "name": "Saudi Arabia", "currency_code": "SAR"},
    ]


def test_product_response_uses_region_reference_data(authenticated_client, product_factory) -> None:
    product_factory(location="JO")

    response = authenticated_client.get(reverse("product-list"))

    assert response.status_code == 200
    assert response.data["results"][0]["location"] == "JO"
    assert response.data["results"][0]["location_name"] == "Jordan"
    assert response.data["results"][0]["currency"] == "JOD"
