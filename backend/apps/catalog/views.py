from django.db.models import QuerySet
from django.db.models.deletion import ProtectedError
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.views import IsApplicationAdmin
from apps.catalog.models import Product, Region
from apps.catalog.pagination import ProductPagination
from apps.catalog.serializers import (
    ProductListQuerySerializer,
    ProductSerializer,
    ProductWriteSerializer,
    RegionSerializer,
)


class ProductMutationPermission(IsAuthenticated):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.method in {"GET", "HEAD", "OPTIONS"} or IsApplicationAdmin().has_permission(
            request, view
        )


@extend_schema(
    summary="List regions",
    description="Return active catalog regions and their settlement currency metadata.",
    responses={
        200: RegionSerializer(many=True),
        401: OpenApiResponse(description="A valid access token is required."),
    },
)
class RegionListView(ListAPIView):
    serializer_class = RegionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    queryset = (
        Region.objects.filter(is_active=True)
        .only("code", "name", "currency_code", "minor_unit")
        .order_by("code")
    )


@extend_schema(
    summary="List products",
    description="Return a deterministic, paginated product list with optional regional filtering.",
    parameters=[ProductListQuerySerializer],
    responses={
        200: ProductSerializer(many=True),
        400: OpenApiResponse(description="Invalid page, page size, or location."),
        401: OpenApiResponse(description="A valid access token is required."),
    },
)
class ProductListView(ListCreateAPIView):
    serializer_class = ProductSerializer
    pagination_class = ProductPagination
    permission_classes = [ProductMutationPermission]

    def get_serializer_class(self):
        return ProductWriteSerializer if self.request.method == "POST" else ProductSerializer

    def get_queryset(self) -> QuerySet[Product]:
        query = ProductListQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)

        products = Product.objects.select_related("location").order_by("id")
        location = query.validated_data.get("location")
        if location:
            products = products.filter(location_id=location)
        return products


@extend_schema(
    summary="Retrieve a product",
    responses={
        200: ProductSerializer,
        401: OpenApiResponse(description="A valid access token is required."),
        404: OpenApiResponse(description="The product does not exist."),
    },
)
class ProductDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = ProductSerializer
    permission_classes = [ProductMutationPermission]

    def get_queryset(self) -> QuerySet[Product]:
        if self.request.method == "DELETE":
            return Product.objects.all()
        return Product.objects.select_related("location")

    def get_serializer_class(self):
        if self.request.method in {"PUT", "PATCH"}:
            return ProductWriteSerializer
        return ProductSerializer

    @extend_schema(
        summary="Delete a product",
        description=(
            "Delete an unpurchased catalog item. Products referenced by immutable purchase "
            "receipts are protected and return 409 Conflict."
        ),
        responses={
            204: None,
            401: OpenApiResponse(description="A valid access token is required."),
            403: OpenApiResponse(description="Administrator privileges are required."),
            404: OpenApiResponse(description="The product does not exist."),
            409: OpenApiResponse(description="The product is referenced by purchase history."),
        },
    )
    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": (
                        "This product cannot be deleted because it is referenced by an "
                        "existing purchase receipt."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
