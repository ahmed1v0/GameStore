import pytest
from django.urls import reverse
from rest_framework.test import APIClient


def test_schema_is_public_and_contains_application_contract(api_client: APIClient) -> None:
    response = api_client.get(reverse("schema"), HTTP_ACCEPT="application/json")

    assert response.status_code == 200
    paths = response.data["paths"]
    assert "/api/v1/auth/login" in paths
    assert {
        f"/api/v1/auth/{name}"
        for name in [
            "signup",
            "refresh",
            "logout",
            "me",
            "csrf",
            "verify-email",
            "resend-verification",
            "forgot-password",
            "reset-password",
            "change-password",
        ]
    } <= set(paths)
    assert "/api/v1/admin/users" in paths
    assert "/api/v1/admin/users/{id}" in paths

    csrf_parameter = next(
        p
        for p in paths["/api/v1/auth/login"]["post"]["parameters"]
        if p["name"] == "X-CSRFToken"
    )
    assert csrf_parameter["required"] is False
    assert "Swagger UI" in csrf_parameter["description"]

    assert "/api/v1/products" in paths
    assert "/api/v1/products/{id}" in paths
    assert "/api/v1/orders" in paths
    assert "/api/v1/orders/{id}" in paths
    assert "jwtAuth" in response.data["components"]["securitySchemes"]

    product_parameters = paths["/api/v1/products"]["get"]["parameters"]
    assert {parameter["name"] for parameter in product_parameters} >= {
        "location",
        "page",
        "page_size",
    }


@pytest.mark.django_db
def test_swagger_ui_is_public_and_initializes_csrf(api_client: APIClient) -> None:
    response = api_client.get(reverse("swagger-ui"))

    assert response.status_code == 200
    assert b"Game Store API" in response.content
    assert b"requestInterceptor" in response.content
    assert b"/api/v1/auth/csrf" in response.content
    assert b"X-CSRFToken" in response.content
