from decimal import Decimal
from uuid import uuid4

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.catalog.models import Product
from apps.orders.models import Order

pytestmark = pytest.mark.django_db


def test_authenticated_user_can_purchase(
    authenticated_client: APIClient, user, product_factory
) -> None:
    product = product_factory(
        title="Petra Explorer Pack",
        price=Decimal("19.99"),
        location=Product.Location.JORDAN,
    )

    response = authenticated_client.post(
        reverse("order-create"),
        {"product_id": product.id},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )

    assert response.status_code == 201
    order = Order.objects.get()
    assert order.user == user
    assert order.product == product
    assert order.product_title == "Petra Explorer Pack"
    assert order.unit_price == Decimal("19.99")
    assert order.product_location == "JO"
    assert response.data["id"] == order.id


def test_caller_cannot_submit_another_user_id(
    authenticated_client: APIClient, user, django_user_model, product_factory
) -> None:
    another_user = django_user_model.objects.create_user(username="another", password="password")
    product = product_factory()

    response = authenticated_client.post(
        reverse("order-create"),
        {"product_id": product.id, "user_id": another_user.id},
        format="json",
    )

    assert response.status_code == 400
    assert str(response.data["user_id"]) == "Unknown field."
    assert Order.objects.count() == 0


def test_receipt_snapshots_survive_product_changes(
    authenticated_client: APIClient, product_factory
) -> None:
    product = product_factory(title="Original title", price=Decimal("10.00"), location="SA")
    purchase_response = authenticated_client.post(
        reverse("order-create"),
        {"product_id": product.id},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    order_id = purchase_response.data["id"]

    product.title = "Changed title"
    product.price = Decimal("20.00")
    product.location = "JO"
    product.save()

    receipt = authenticated_client.get(reverse("order-detail", args=[order_id]))

    assert receipt.status_code == 200
    assert receipt.data["product_title"] == "Original title"
    assert receipt.data["unit_price"] == "10.00"
    assert receipt.data["product_location"] == "SA"


def test_unknown_product_is_rejected(authenticated_client: APIClient) -> None:
    response = authenticated_client.post(
        reverse("order-create"),
        {"product_id": 999999},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )

    assert response.status_code == 404
    assert Order.objects.count() == 0


@pytest.mark.parametrize("payload", [{}, {"product_id": 0}, {"product_id": "invalid"}])
def test_invalid_purchase_payload_is_rejected(
    authenticated_client: APIClient, payload: dict[str, object]
) -> None:
    response = authenticated_client.post(reverse("order-create"), payload, format="json")

    assert response.status_code == 400
    assert "product_id" in response.data
    assert Order.objects.count() == 0


def test_unauthenticated_purchase_is_rejected(api_client: APIClient, product_factory) -> None:
    product = product_factory()

    response = api_client.post(reverse("order-create"), {"product_id": product.id}, format="json")

    assert response.status_code == 401
    assert Order.objects.count() == 0


def test_user_cannot_read_another_users_receipt(
    authenticated_client: APIClient, django_user_model, product_factory
) -> None:
    another_user = django_user_model.objects.create_user(username="another", password="password")
    product = product_factory()
    order = Order.objects.create(
        user=another_user,
        product=product,
        product_title=product.title,
        unit_price=product.price,
        product_location=product.location,
    )

    response = authenticated_client.get(reverse("order-detail", args=[order.id]))

    assert response.status_code == 404
