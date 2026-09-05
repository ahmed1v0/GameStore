from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.authentication import issue_refresh
from apps.catalog.models import Product

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_client(django_user_model) -> APIClient:
    admin = django_user_model.objects.create_user(
        username="admin", password="correct-password", is_staff=True, is_superuser=True
    )
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issue_refresh(admin).access_token}")
    return client


def product_data():
    return {
        "title": "Starter Pack",
        "description": "A digital game item.",
        "price": "12.50",
        "location": "JO",
    }


def test_admin_can_create_product(admin_client: APIClient) -> None:
    response = admin_client.post(reverse("product-list"), product_data(), format="json")

    assert response.status_code == 201
    assert response.data["id"] > 0
    assert response.data["title"] == "Starter Pack"
    assert Product.objects.filter(id=response.data["id"], price=Decimal("12.50")).exists()


def test_admin_can_edit_product(admin_client: APIClient, product_factory) -> None:
    product = product_factory(id=101)

    response = admin_client.patch(
        reverse("product-detail", args=[product.id]),
        {"title": "Updated Pack", "price": "25.00", "location": "SA"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["created_at"]
    assert response.data["updated_at"]
    product.refresh_from_db()
    assert product.title == "Updated Pack"
    assert product.price == Decimal("25.00")
    assert product.location == Product.Location.SAUDI_ARABIA


def test_regular_user_cannot_mutate_products(
    authenticated_client: APIClient, product_factory
) -> None:
    product = product_factory(id=102)

    create_response = authenticated_client.post(
        reverse("product-list"), product_data(), format="json"
    )
    update_response = authenticated_client.patch(
        reverse("product-detail", args=[product.id]), {"title": "Blocked"}, format="json"
    )

    assert create_response.status_code == 403
    assert update_response.status_code == 403
