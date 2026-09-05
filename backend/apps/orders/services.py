from django.contrib.auth.base_user import AbstractBaseUser
from django.db import transaction

from apps.catalog.models import Product
from apps.orders.models import Order


@transaction.atomic
def purchase_product(*, user: AbstractBaseUser, product: Product) -> Order:
    return Order.objects.create(
        user=user,
        product=product,
        product_title=product.title,
        unit_price=product.price,
        product_location=product.location,
    )
