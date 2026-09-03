from django.urls import path

from modules.system.presentation.views import HealthView

urlpatterns = [path("health/", HealthView.as_view(), name="health")]
