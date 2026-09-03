from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import RetrieveAPIView
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product
from apps.orders.models import Order
from apps.orders.serializers import OrderReceiptSerializer, PurchaseRequestSerializer
from apps.orders.services import purchase_product


@extend_schema(
    summary="Purchase one product",
    description=(
        "Create an order for the authenticated user and snapshot the product values used by the "
        "receipt."
    ),
    request=PurchaseRequestSerializer,
    responses={
        201: OrderReceiptSerializer,
        400: OpenApiResponse(description="The purchase request is malformed."),
        401: OpenApiResponse(description="A valid access token is required."),
        404: OpenApiResponse(description="The product does not exist."),
    },
)
class OrderCreateView(APIView):
    def post(self, request: Request) -> Response:
        request_serializer = PurchaseRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        product = get_object_or_404(Product, pk=request_serializer.validated_data["product_id"])

        order = purchase_product(user=request.user, product=product)
        return Response(OrderReceiptSerializer(order).data, status=status.HTTP_201_CREATED)


@extend_schema(
    summary="Retrieve an order receipt",
    description="Return a receipt owned by the authenticated user.",
    responses={
        200: OrderReceiptSerializer,
        401: OpenApiResponse(description="A valid access token is required."),
        404: OpenApiResponse(description="The order does not exist or belongs to another user."),
    },
)
class OrderDetailView(RetrieveAPIView):
    serializer_class = OrderReceiptSerializer

    def get_queryset(self) -> QuerySet[Order]:
        return Order.objects.filter(user=self.request.user).select_related("product")
