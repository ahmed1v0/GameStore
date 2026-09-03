import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.catalog.models import Product

pytestmark = pytest.mark.django_db


def test_returns_products_with_pagination_metadata(
    authenticated_client: APIClient, product_factory
) -> None:
    product_factory(id=2)
    product_factory(id=1)

    response = authenticated_client.get(reverse("product-list"))

    assert response.status_code == 200
    assert set(response.data) == {"count", "next", "previous", "results"}
    assert response.data["count"] == 2
    assert [product["id"] for product in response.data["results"]] == [1, 2]


def test_uses_default_page_size(authenticated_client: APIClient, product_factory) -> None:
    for _ in range(13):
        product_factory()

    response = authenticated_client.get(reverse("product-list"))

    assert len(response.data["results"]) == 12
    assert response.data["next"] is not None


def test_supports_custom_page_size(authenticated_client: APIClient, product_factory) -> None:
    for _ in range(8):
        product_factory()

    response = authenticated_client.get(reverse("product-list"), {"page_size": 5, "page": 2})

    assert len(response.data["results"]) == 3
    assert response.data["previous"] is not None


def test_caps_page_size(authenticated_client: APIClient, product_factory) -> None:
    for _ in range(50):
        product_factory()

    response = authenticated_client.get(reverse("product-list"), {"page_size": 500})

    assert len(response.data["results"]) == 48
    assert response.data["count"] == 50


@pytest.mark.parametrize("location", [Product.Location.JORDAN, Product.Location.SAUDI_ARABIA])
def test_filters_by_location(
    authenticated_client: APIClient, product_factory, location: str
) -> None:
    product_factory(location=Product.Location.JORDAN)
    product_factory(location=Product.Location.SAUDI_ARABIA)

    response = authenticated_client.get(reverse("product-list"), {"location": location})

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["location"] == location


def test_rejects_invalid_location(authenticated_client: APIClient) -> None:
    response = authenticated_client.get(reverse("product-list"), {"location": "US"})

    assert response.status_code == 400
    assert "location" in response.data


def test_rejects_unauthenticated_request(api_client: APIClient) -> None:
    response = api_client.get(reverse("product-list"))

    assert response.status_code == 401
