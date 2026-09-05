from collections.abc import Callable
from decimal import Decimal
from typing import Any

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.accounts.authentication import issue_refresh
from apps.catalog.models import Product


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(username="demo", password="correct-password")


@pytest.fixture
def authenticated_client(user) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issue_refresh(user).access_token}")
    return client


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()


@pytest.fixture
def product_factory() -> Callable[..., Product]:
    next_id = 1

    def create_product(**overrides: Any) -> Product:
        nonlocal next_id
        values = {
            "id": next_id,
            "title": f"Product {next_id}",
            "description": "A digital game item.",
            "price": Decimal("10.00"),
            "location": Product.Location.JORDAN,
        }
        values.update(overrides)
        next_id = max(next_id + 1, int(values["id"]) + 1)
        return Product.objects.create(**values)

    return create_product
