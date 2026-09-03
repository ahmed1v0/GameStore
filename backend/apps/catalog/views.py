from django.db.models import QuerySet
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.generics import ListAPIView, RetrieveAPIView

from apps.catalog.models import Product
from apps.catalog.pagination import ProductPagination
from apps.catalog.serializers import ProductListQuerySerializer, ProductSerializer


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
class ProductListView(ListAPIView):
    serializer_class = ProductSerializer
    pagination_class = ProductPagination

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
class ProductDetailView(RetrieveAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
