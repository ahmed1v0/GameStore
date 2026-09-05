from uuid import UUID

from django.contrib.auth.base_user import AbstractBaseUser
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException

from apps.catalog.models import Product
from apps.orders.models import Order


class IdempotencyConflict(APIException):
    status_code = 409
    default_detail = "This Idempotency-Key was already used for a different product."
    default_code = "idempotency_conflict"


@transaction.atomic
def purchase_product(
    *, user: AbstractBaseUser, product_id: int, idempotency_key: UUID
) -> tuple[Order, bool]:
    existing = Order.objects.filter(user=user, idempotency_key=idempotency_key).first()
    if existing:
        if existing.product_id != product_id:
            raise IdempotencyConflict()
        return existing, False

    product = get_object_or_404(Product.objects.select_related("location"), pk=product_id)
    # The database uniqueness constraint arbitrates concurrent retries across workers.
    # The receipt snapshots every customer-visible monetary and regional value so later
    # catalog changes cannot rewrite purchase history.
    order, created = Order.objects.get_or_create(
        user=user,
        idempotency_key=idempotency_key,
        defaults={
            "product": product,
            "product_title": product.title,
            "unit_price": product.price,
            "product_location": product.location_id,
            "product_location_name": product.location.name,
            "currency_code": product.location.currency_code,
            "currency_minor_unit": product.location.minor_unit,
        },
    )
    if order.product_id != product_id:
        raise IdempotencyConflict()
    return order, created
