from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import RetrieveAPIView
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product
from apps.orders.models import Order
from apps.orders.serializers import OrderReceiptSerializer, PurchaseRequestSerializer
from apps.orders.services import purchase_product


class OrderCreateView(APIView):
    def post(self, request: Request) -> Response:
        request_serializer = PurchaseRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        product = get_object_or_404(Product, pk=request_serializer.validated_data["product_id"])

        order = purchase_product(user=request.user, product=product)
        return Response(OrderReceiptSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderDetailView(RetrieveAPIView):
    serializer_class = OrderReceiptSerializer

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return Order.objects.filter(user=self.request.user).select_related("product")
