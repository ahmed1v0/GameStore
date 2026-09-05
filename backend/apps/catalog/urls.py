from django.urls import path

from apps.catalog.views import ProductDetailView, ProductListView, RegionListView

urlpatterns = [
    path("regions", RegionListView.as_view(), name="region-list"),
    path("products", ProductListView.as_view(), name="product-list"),
    path("products/<int:pk>", ProductDetailView.as_view(), name="product-detail"),
]
