from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.db import close_old_connections, connection, transaction
from django.db.models.query import QuerySet
from rest_framework.test import APIClient

from apps.orders.models import Order
from apps.orders.services import purchase_product

pytestmark = pytest.mark.django_db


def buy(client, product_id, key):
    return client.post(
        "/api/v1/orders",
        {"product_id": product_id},
        format="json",
        **({"HTTP_IDEMPOTENCY_KEY": str(key)} if key is not None else {}),
    )


@pytest.mark.parametrize("key", [None, "", "invalid", "x" * 300])
def test_key_is_required_and_must_be_uuid(authenticated_client, product_factory, key):
    response = buy(authenticated_client, product_factory().pk, key)
    assert response.status_code == 400
    assert "Idempotency-Key" in response.data
    assert not Order.objects.exists()


def test_replay_returns_exact_snapshot(authenticated_client, product_factory):
    product = product_factory()
    key = uuid4()
    original = buy(authenticated_client, product.pk, key)
    product.title = "Changed"
    product.price = Decimal("999.99")
    product.save()
    replay = buy(authenticated_client, product.pk, key)
    assert original.status_code == replay.status_code == 201
    assert original.data == replay.data
    assert original["Idempotency-Replayed"] == "false"
    assert replay["Idempotency-Replayed"] == "true"
    assert Order.objects.count() == 1


def test_key_reuse_with_different_payload_conflicts(authenticated_client, product_factory):
    key = uuid4()
    first, second = product_factory(), product_factory()
    buy(authenticated_client, first.pk, key)
    for product_id in (second.pk, 999999):
        response = buy(authenticated_client, product_id, key)
        assert response.status_code == 409
    assert Order.objects.count() == 1


def test_new_key_allows_intentional_repeat_purchase(authenticated_client, product_factory):
    product = product_factory()
    one = buy(authenticated_client, product.pk, uuid4())
    two = buy(authenticated_client, product.pk, uuid4())
    assert one.status_code == two.status_code == 201
    assert one.data["id"] != two.data["id"]


def test_keys_are_scoped_to_current_customer(
    authenticated_client, django_user_model, product_factory
):
    other = APIClient()
    other.force_authenticate(django_user_model.objects.create_user(username="other-customer"))
    product, key = product_factory(), uuid4()
    original = buy(authenticated_client, product.pk, key)
    separate = buy(other, product.pk, key)
    assert original.status_code == separate.status_code == 201
    assert original.data["id"] != separate.data["id"]
    assert other.get(f"/api/v1/orders/{original.data['id']}").status_code == 404


def test_rejected_request_does_not_reserve_key(authenticated_client, product_factory):
    key = uuid4()
    assert buy(authenticated_client, 999999, key).status_code == 404
    assert buy(authenticated_client, product_factory().pk, key).status_code == 201
    assert Order.objects.count() == 1


def test_rollback_removes_order_and_key_together(user, product_factory):
    product, key = product_factory(), uuid4()
    with pytest.raises(RuntimeError), transaction.atomic():
        purchase_product(user=user, product_id=product.pk, idempotency_key=key)
        raise RuntimeError("abort transaction")
    assert not Order.objects.exists()
    _, created = purchase_product(user=user, product_id=product.pk, idempotency_key=key)
    assert created


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("different_products", [False, True])
def test_concurrent_purchases_commit_one_order(user, product_factory, different_products):
    if connection.vendor != "postgresql":
        pytest.skip("This race verifies PostgreSQL unique-constraint arbitration.")
    first = product_factory()
    second = product_factory() if different_products else first
    key, barrier = uuid4(), Barrier(2)
    original_create = QuerySet.create

    def synchronized_create(queryset, **kwargs):
        if queryset.model is Order:
            barrier.wait(timeout=10)
        return original_create(queryset, **kwargs)

    def request(product_id):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(user)
            response = buy(client, product_id, key)
            return response.status_code, response.data, response.get("Idempotency-Replayed")
        finally:
            close_old_connections()

    with patch.object(QuerySet, "create", synchronized_create), ThreadPoolExecutor(2) as pool:
        futures = [pool.submit(request, product_id) for product_id in (first.pk, second.pk)]
        results = [future.result(timeout=20) for future in futures]
    assert Order.objects.count() == 1
    if different_products:
        assert sorted(result[0] for result in results) == [201, 409]
    else:
        assert [result[0] for result in results] == [201, 201]
        assert results[0][1] == results[1][1]
        assert {result[2] for result in results} == {"true", "false"}


def test_cors_allows_browser_purchase_key(api_client):
    response = api_client.options(
        "/api/v1/orders",
        HTTP_ORIGIN="http://localhost:3000",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="authorization,content-type,idempotency-key",
    )
    assert response.status_code == 200
    assert "idempotency-key" in response["Access-Control-Allow-Headers"].lower()
