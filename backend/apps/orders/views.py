from django.db.models import QuerySet
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, OpenApiTypes, extend_schema
from rest_framework import serializers, status
from rest_framework.generics import RetrieveAPIView
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from apps.orders.serializers import OrderReceiptSerializer, PurchaseRequestSerializer
from apps.orders.services import purchase_product


@extend_schema(
    summary="Purchase one product",
    description=(
        "Create an order for the authenticated user and snapshot the product values used by the "
        "receipt. Requires a UUID Idempotency-Key scoped to the authenticated user. Repeating "
        "the same key and product returns the original receipt and 201, without creating an "
        "order. Reusing a key for another product returns 409. Keys do not expire. "
        "Idempotency-Replayed is true for replays and false for new orders."
    ),
    parameters=[
        OpenApiParameter(
            "Idempotency-Key",
            OpenApiTypes.UUID,
            OpenApiParameter.HEADER,
            required=True,
            description="Generate once per purchase intent; reuse on every retry.",
        ),
        OpenApiParameter(
            "Idempotency-Replayed",
            OpenApiTypes.BOOL,
            OpenApiParameter.HEADER,
            response=[201],
            description="Whether the original receipt was replayed.",
        ),
    ],
    request=PurchaseRequestSerializer,
    responses={
        201: OrderReceiptSerializer,
        400: OpenApiResponse(description="The purchase request is malformed."),
        401: OpenApiResponse(description="A valid access token is required."),
        404: OpenApiResponse(description="The product does not exist."),
        409: OpenApiResponse(description="The key was already used for a different product."),
    },
)
class OrderCreateView(APIView):
    def post(self, request: Request) -> Response:
        request_serializer = PurchaseRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        try:
            key = serializers.UUIDField().run_validation(request.headers.get("Idempotency-Key"))
        except serializers.ValidationError as exc:
            raise serializers.ValidationError(
                {"Idempotency-Key": "A valid UUID Idempotency-Key header is required."}
            ) from exc
        order, created = purchase_product(
            user=request.user,
            product_id=request_serializer.validated_data["product_id"],
            idempotency_key=key,
        )
        return Response(
            OrderReceiptSerializer(order).data,
            status=status.HTTP_201_CREATED,
            headers={"Idempotency-Replayed": "false" if created else "true"},
        )


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
        return Order.objects.filter(user=self.request.user)
