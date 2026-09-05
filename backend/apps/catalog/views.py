from django.db.models import QuerySet
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated

from apps.accounts.views import IsApplicationAdmin
from apps.catalog.models import Product
from apps.catalog.pagination import ProductPagination
from apps.catalog.serializers import (
    ProductListQuerySerializer,
    ProductSerializer,
    ProductWriteSerializer,
)


class ProductMutationPermission(IsAuthenticated):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.method in {"GET", "HEAD", "OPTIONS"} or IsApplicationAdmin().has_permission(
            request, view
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

        products = Product.objects.order_by("id")
        location = query.validated_data.get("location")
        if location:
            products = products.filter(location=location)
        return products


@extend_schema(
    summary="Retrieve a product",
    responses={
        200: ProductSerializer,
        401: OpenApiResponse(description="A valid access token is required."),
        404: OpenApiResponse(description="The product does not exist."),
    },
)
class ProductDetailView(RetrieveUpdateAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [ProductMutationPermission]

    def get_serializer_class(self):
        if self.request.method in {"PUT", "PATCH"}:
            return ProductWriteSerializer
        return ProductSerializer
