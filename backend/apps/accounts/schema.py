from drf_spectacular.extensions import OpenApiAuthenticationExtension


class AccountJWTAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "apps.accounts.authentication.AccountJWTAuthentication"
    name = "jwtAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}


def document_auth_errors(result, generator, request, public):
    for path, operations in result["paths"].items():
        for method, operation in operations.items():
            if not isinstance(operation, dict) or method not in {"get", "post", "patch"}:
                continue
            if not path.startswith(("/api/v1/auth/", "/api/v1/admin/")):
                continue
            for code, description in {
                "400": "Invalid fields or expired/consumed link. Returns detail or field errors.",
                "401": "Invalid credentials. Unverified login returns code=email_unverified.",
                "403": "CSRF validation failed or administrator permission is required.",
                "429": "Too many attempts. Retry-After gives the delay in seconds.",
            }.items():
                operation.setdefault("responses", {}).setdefault(code, {"description": description})
            if path.startswith("/api/v1/auth/") and method == "post":
                csrf_note = (
                    "Browser clients require X-CSRFToken from GET /api/v1/auth/csrf. "
                    "Swagger UI injects it automatically."
                )
                existing = operation.get("description", "").rstrip()
                operation["description"] = f"{existing}\n\n{csrf_note}".strip()
            if path in {"/api/v1/auth/refresh", "/api/v1/auth/logout"} and method == "post":
                operation.setdefault("parameters", []).append(
                    {
                        "name": "game_store_refresh",
                        "in": "cookie",
                        "required": path.endswith("refresh"),
                        "schema": {"type": "string"},
                        "description": "HttpOnly cookie set by login/refresh; absent from JSON.",
                    }
                )
    return result
