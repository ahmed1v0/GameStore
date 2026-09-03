import pytest
from django.test import override_settings
from django.urls import path, reverse
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.test import APIClient
from rest_framework.views import APIView


class ProtectedView(APIView):
    def get(self, request: Request) -> Response:
        return Response({"username": request.user.username})


urlpatterns = [path("protected", ProtectedView.as_view())]


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.mark.django_db
def test_valid_credentials_return_tokens(api_client: APIClient, django_user_model) -> None:
    django_user_model.objects.create_user(username="demo", password="correct-password")

    response = api_client.post(
        reverse("token_obtain_pair"),
        {"username": "demo", "password": "correct-password"},
        format="json",
    )

    assert response.status_code == 200
    assert set(response.data) == {"access", "refresh"}


@pytest.mark.django_db
def test_invalid_credentials_are_rejected(api_client: APIClient, django_user_model) -> None:
    django_user_model.objects.create_user(username="demo", password="correct-password")

    response = api_client.post(
        reverse("token_obtain_pair"),
        {"username": "demo", "password": "wrong-password"},
        format="json",
    )

    assert response.status_code == 401


@override_settings(ROOT_URLCONF=__name__)
def test_default_permission_rejects_unauthenticated_request(api_client: APIClient) -> None:
    response = api_client.get("/protected")

    assert response.status_code == 401
