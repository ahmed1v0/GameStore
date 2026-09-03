from rest_framework import serializers

from apps.catalog.models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ("id", "title", "description", "price", "location", "created_at", "updated_at")


class ProductListQuerySerializer(serializers.Serializer):
    location = serializers.ChoiceField(choices=Product.Location.choices, required=False)
