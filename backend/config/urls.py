from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny

from config.views import LoginView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/login", LoginView.as_view(), name="token_obtain_pair"),
    path("api/v1/", include("apps.catalog.urls")),
    path("api/v1/", include("apps.orders.urls")),
    path(
        "api/schema/",
        SpectacularAPIView.as_view(authentication_classes=[], permission_classes=[AllowAny]),
        name="schema",
    ),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(
            url_name="schema", authentication_classes=[], permission_classes=[AllowAny]
        ),
        name="swagger-ui",
    ),
]
