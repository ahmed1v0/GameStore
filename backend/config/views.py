from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


@extend_schema(
    summary="Log in",
    description=(
        "Exchange Django username and password credentials for JWT access and refresh tokens."
    ),
    request=TokenObtainPairSerializer,
    responses={
        200: TokenObtainPairSerializer,
        401: OpenApiResponse(description="The supplied credentials are invalid."),
    },
    auth=[],
)
class LoginView(TokenObtainPairView):
    pass
