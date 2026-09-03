from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/login", TokenObtainPairView.as_view(), name="token_obtain_pair"),
]
