from rest_framework import serializers

from apps.catalog.models import Product, Region, RegionCode
from apps.catalog.money import exceeds_minor_unit, precision_error


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ("code", "name", "currency_code", "minor_unit")


class ProductSerializer(serializers.ModelSerializer):
    location = serializers.CharField(source="location_id", read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True)
    currency = serializers.CharField(source="location.currency_code", read_only=True)
    minor_unit = serializers.IntegerField(source="location.minor_unit", read_only=True)

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
            "minor_unit",
            "created_at",
            "updated_at",
        )


class ProductWriteSerializer(serializers.ModelSerializer):
    location = serializers.PrimaryKeyRelatedField(
        queryset=Region.objects.filter(is_active=True),
    )
    location_name = serializers.CharField(source="location.name", read_only=True)
    currency = serializers.CharField(source="location.currency_code", read_only=True)
    minor_unit = serializers.IntegerField(source="location.minor_unit", read_only=True)

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
            "minor_unit",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Price must be non-negative.")
        return value

    def validate(self, attrs):
        location = attrs.get("location")
        price = attrs.get("price")
        if self.instance is not None:
            location = location or self.instance.location
            price = price if price is not None else self.instance.price
        if location is not None and price is not None and exceeds_minor_unit(
            price, location.minor_unit
        ):
            raise serializers.ValidationError(
                {"price": precision_error(location.currency_code, location.minor_unit)}
            )
        return attrs


class ProductListQuerySerializer(serializers.Serializer):
    location = serializers.ChoiceField(choices=RegionCode.choices, required=False)
