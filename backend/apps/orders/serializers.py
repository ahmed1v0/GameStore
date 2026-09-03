from rest_framework import serializers

from apps.orders.models import Order


class PurchaseRequestSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)


class OrderReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = (
            "id",
            "product_id",
            "product_title",
            "unit_price",
            "product_location",
            "created_at",
        )
