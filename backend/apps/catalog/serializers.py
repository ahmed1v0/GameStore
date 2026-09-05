from rest_framework import serializers

from apps.catalog.models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ("id", "title", "description", "price", "location", "created_at", "updated_at")


class ProductWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ("id", "title", "description", "price", "location", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Price must be non-negative.")
        return value


class ProductListQuerySerializer(serializers.Serializer):
    location = serializers.ChoiceField(choices=Product.Location.choices, required=False)
