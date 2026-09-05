from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.authentication import issue_refresh
from apps.catalog.models import Product
from apps.orders.models import Order

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
    assert product.location_id == Product.Location.SAUDI_ARABIA


def test_admin_can_delete_unpurchased_product(admin_client: APIClient, product_factory) -> None:
    product = product_factory(id=103)

    response = admin_client.delete(reverse("product-detail", args=[product.id]))

    assert response.status_code == 204
    assert not Product.objects.filter(id=product.id).exists()


def test_product_with_purchase_history_cannot_be_deleted(
    admin_client: APIClient, product_factory, django_user_model
) -> None:
    product = product_factory(id=104)
    buyer = django_user_model.objects.create_user(username="buyer", password="correct-password")
    order = Order.objects.create(
        user=buyer,
        product=product,
        product_title=product.title,
        unit_price=product.price,
        product_location=product.location_id,
        product_location_name="Jordan",
        currency_code="JOD",
        currency_minor_unit=3,
    )

    response = admin_client.delete(reverse("product-detail", args=[product.id]))

    assert response.status_code == 409
    assert "purchase receipt" in response.data["detail"]
    assert Product.objects.filter(id=product.id).exists()
    assert Order.objects.filter(id=order.id, product_id=product.id).exists()


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
    delete_response = authenticated_client.delete(reverse("product-detail", args=[product.id]))

    assert create_response.status_code == 403
    assert update_response.status_code == 403
    assert delete_response.status_code == 403
    assert Product.objects.filter(id=product.id).exists()
