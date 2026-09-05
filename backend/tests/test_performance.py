"""Query budgets include real JWT authentication, not force-authenticated shortcuts."""

import pytest
from django.contrib.auth.models import Group
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.accounts.models import ADMIN_GROUP
from apps.orders.models import Order

pytestmark = pytest.mark.django_db


def measured_get(client, path, params=None):
    with CaptureQueriesContext(connection) as queries:
        response = client.get(path, params or {})
    assert response.status_code == 200
    return response, [entry["sql"] for entry in queries]


def test_catalog_pagination_happens_in_sql(authenticated_client, product_factory):
    for index in range(60):
        product_factory(location="JO" if index % 2 else "SA")
    response, queries = measured_get(
        authenticated_client, "/api/v1/products", {"page": 2, "page_size": 12, "location": "JO"}
    )
    assert response.data["count"] == 30
    assert len(response.data["results"]) == 12
    assert [item["id"] for item in response.data["results"]] == list(range(26, 49, 2))
    assert len(queries) <= 4
    page_query = next(sql for sql in queries if 'FROM "catalog_product"' in sql and "LIMIT" in sql)
    assert "LIMIT 12 OFFSET 12" in page_query
    assert "ORDER BY" in page_query and "location" in page_query
    assert 'JOIN "catalog_region"' in page_query


def test_user_pages_have_constant_query_cost_and_server_search(
    authenticated_client, user, django_user_model
):
    group = Group.objects.get(name=ADMIN_GROUP)
    user.groups.add(group)
    _, small_queries = measured_get(authenticated_client, "/api/v1/admin/users")
    created = []
    for index in range(25):
        member = django_user_model.objects.create_user(
            username=f"performance-{index:02}", email=f"performance-{index}@example.com"
        )
        if index % 2:
            member.groups.add(group)
        created.append(member)
    first, full_queries = measured_get(authenticated_client, "/api/v1/admin/users")
    assert len(first.data["results"]) == 20
    assert len(full_queries) == len(small_queries) <= 6
    second, queries = measured_get(
        authenticated_client, "/api/v1/admin/users", {"page": 2, "search": "performance-"}
    )
    assert second.data["count"] == 25
    assert [item["id"] for item in second.data["results"]] == [item.pk for item in created[20:]]
    assert [item["role"] for item in second.data["results"]] == [
        "user",
        "admin",
        "user",
        "admin",
        "user",
    ]
    assert len(queries) <= 6
    assert any("LIMIT 5 OFFSET 20" in sql and "LIKE" in sql for sql in queries)


def test_detail_pages_have_bounded_queries_without_receipt_product_join(
    authenticated_client, user, product_factory
):
    product = product_factory()
    order = Order.objects.create(
        user=user,
        product=product,
        product_title=product.title,
        unit_price=product.price,
        product_location=product.location_id,
        product_location_name=product.location.name,
        currency_code=product.location.currency_code,
        currency_minor_unit=product.location.minor_unit,
    )
    _, product_queries = measured_get(authenticated_client, f"/api/v1/products/{product.pk}")
    receipt, receipt_queries = measured_get(authenticated_client, f"/api/v1/orders/{order.pk}")
    assert len(product_queries) <= 3
    assert len(receipt_queries) <= 3
    assert receipt.data["product_title"] == product.title
    assert not any('JOIN "catalog_product"' in sql for sql in receipt_queries)
    _, identity_queries = measured_get(authenticated_client, "/api/v1/auth/me")
    assert len(identity_queries) <= 3
