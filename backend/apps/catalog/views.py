from django.db.models import QuerySet
from rest_framework.generics import ListAPIView, RetrieveAPIView

from apps.catalog.models import Product
from apps.catalog.pagination import ProductPagination
from apps.catalog.serializers import ProductListQuerySerializer, ProductSerializer


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


class ProductDetailView(RetrieveAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
