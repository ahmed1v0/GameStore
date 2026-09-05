from rest_framework import serializers

from apps.catalog.models import Product, Region, RegionCode


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ("code", "name", "currency_code")


class ProductSerializer(serializers.ModelSerializer):
    location = serializers.CharField(source="location_id", read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True)
    currency = serializers.CharField(source="location.currency_code", read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "title",
            "description",
            "price",
            "location",
            "location_name",
            "currency",
            "created_at",
            "updated_at",
        )


class ProductWriteSerializer(serializers.ModelSerializer):
    location = serializers.PrimaryKeyRelatedField(
        queryset=Region.objects.filter(is_active=True),
    )
    location_name = serializers.CharField(source="location.name", read_only=True)
    currency = serializers.CharField(source="location.currency_code", read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "title",
            "description",
            "price",
            "location",
            "location_name",
            "currency",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Price must be non-negative.")
        return value


class ProductListQuerySerializer(serializers.Serializer):
    location = serializers.ChoiceField(choices=RegionCode.choices, required=False)
