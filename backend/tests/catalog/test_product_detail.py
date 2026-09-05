import pytest
from django.urls import reverse
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def test_returns_existing_product(authenticated_client: APIClient, product_factory) -> None:
    product = product_factory(title="Desert Vanguard Outfit")

    response = authenticated_client.get(reverse("product-detail", args=[product.id]))

    assert response.status_code == 200
    assert response.data["id"] == product.id
    assert response.data["title"] == "Desert Vanguard Outfit"
    assert response.data["price"] == "10.00"


def test_returns_not_found_for_unknown_product(authenticated_client: APIClient) -> None:
    response = authenticated_client.get(reverse("product-detail", args=[999999]))

    assert response.status_code == 404


def test_rejects_unauthenticated_product_detail(api_client: APIClient, product_factory) -> None:
    product = product_factory()

    response = api_client.get(reverse("product-detail", args=[product.id]))

    assert response.status_code == 401
