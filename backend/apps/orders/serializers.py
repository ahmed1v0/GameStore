from collections.abc import Mapping
from typing import Any

from rest_framework import serializers

from apps.orders.models import Order


class PurchaseRequestSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)

    def to_internal_value(self, data: Mapping[str, Any]) -> dict[str, Any]:
        unknown_fields = set(data) - set(self.fields)
        if unknown_fields:
            raise serializers.ValidationError(
                {field: "Unknown field." for field in sorted(unknown_fields)}
            )
        return super().to_internal_value(data)


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
