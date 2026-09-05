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

    login_operation = paths["/api/v1/auth/login"]["post"]
    assert not any(
        parameter["name"].lower() == "x-csrftoken"
        for parameter in login_operation.get("parameters", [])
    )
    assert "Swagger UI injects it automatically" in login_operation["description"]

    assert "/api/v1/products" in paths
    assert "/api/v1/products/{id}" in paths
    assert "/api/v1/orders" in paths
    assert "/api/v1/orders/{id}" in paths
    purchase = paths["/api/v1/orders"]["post"]
    key = next(item for item in purchase["parameters"] if item["name"] == "Idempotency-Key")
    assert key["required"] and key["in"] == "header"
    assert key["schema"]["format"] == "uuid"
    assert "409" in purchase["responses"]
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
    assert b"name.toLowerCase()" in response.content
    assert b"X-CSRFToken" in response.content


@pytest.mark.django_db
def test_csrf_token_authorizes_forgot_password_request() -> None:
    client = APIClient(enforce_csrf_checks=True)
    csrf_response = client.get("/api/v1/auth/csrf")

    assert csrf_response.status_code == 200
    token = csrf_response.data["csrfToken"]
    assert len(token) in {32, 64}
    assert "csrftoken" in client.cookies

    response = client.post(
        "/api/v1/auth/forgot-password",
        {"email": "missing@example.com"},
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )

    assert response.status_code == 200
