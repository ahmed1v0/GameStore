from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.middleware.csrf import get_token, rotate_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import filters, status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from . import services
from .authentication import check_account, issue_refresh
from .models import EmailToken
from .serializers import (
    AdminInviteSerializer,
    AdminUpdateSerializer,
    ChangePasswordSerializer,
    CsrfSerializer,
    EmailSerializer,
    LoginSerializer,
    MessageSerializer,
    ResetPasswordSerializer,
    SessionSerializer,
    SignupResponseSerializer,
    SignupSerializer,
    TokenSerializer,
    UserSerializer,
    role_for,
)
from .throttles import AuthThrottle, EmailAddressThrottle, EmailIPThrottle


def clear_refresh(response):
    response.delete_cookie(settings.AUTH_REFRESH_COOKIE, path="/api/v1/auth", samesite="Lax")
    return response


def session_response(user, token):
    response = Response({"access": str(token.access_token), "user": UserSerializer(user).data})
    response.set_cookie(
        settings.AUTH_REFRESH_COOKIE,
        str(token),
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        path="/api/v1/auth",
        secure=settings.AUTH_COOKIE_SECURE,
        httponly=True,
        samesite="Lax",
    )
    response["Cache-Control"] = "no-store"
    return response


@method_decorator(csrf_protect, name="dispatch")
class AuthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthThrottle]

    def get_authenticate_header(self, request):
        return 'Bearer realm="api"'

    def handle_exception(self, exc):
        response = super().handle_exception(exc)
        if isinstance(exc, AuthenticationFailed):
            response.data["code"] = exc.get_codes()
        return response

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response


class CsrfView(AuthView):
    throttle_classes = []

    @extend_schema(responses=CsrfSerializer, auth=[], summary="Initialize CSRF protection")
    def get(self, request):
        return Response(
            {
                "csrfToken": get_token(request),
                "email_verification_enabled": settings.EMAIL_VERIFICATION_ENABLED,
            }
        )


class SignupView(AuthView):
    throttle_classes = [EmailIPThrottle, EmailAddressThrottle]

    @extend_schema(
        request=SignupSerializer,
        responses={201: SignupResponseSerializer},
        auth=[],
        description=(
            "Creates an ordinary user. Verification is controlled by EMAIL_VERIFICATION_ENABLED."
        ),
    )
    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.signup(serializer.validated_data)
        return Response(
            {
                "detail": "Account created. Check your email to verify your account."
                if settings.EMAIL_VERIFICATION_ENABLED
                else "Account created. You can now sign in.",
                "verification_required": settings.EMAIL_VERIFICATION_ENABLED,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(AuthView):
    @extend_schema(
        request=LoginSerializer,
        responses={200: SessionSerializer, 401: MessageSerializer},
        auth=[],
        description=(
            "Returns an access token and user. Sets an HttpOnly refresh cookie. "
            "Requires X-CSRFToken."
        ),
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request=request, **serializer.validated_data)
        if user is None:
            raise AuthenticationFailed("Username or password is incorrect.")
        with transaction.atomic():
            user = get_user_model().objects.select_for_update().get(pk=user.pk)
            # Recheck credentials after acquiring the lock, in case a reset just completed.
            if not user.check_password(serializer.validated_data["password"]):
                raise AuthenticationFailed("Username or password is incorrect.")
            token = issue_refresh(user)
            rotate_token(request)
            return session_response(user, token)


class RefreshView(AuthView):
    throttle_classes = []

    @extend_schema(
        request=None,
        responses={200: SessionSerializer, 401: MessageSerializer},
        auth=[],
        description=(
            "Requires refresh cookie and X-CSRFToken. Rotates and blacklists the old refresh token."
        ),
    )
    def post(self, request):
        raw = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE)
        try:
            token = RefreshToken(raw) if raw else None
            if token is None:
                raise AuthenticationFailed("Sign in to continue.")
            with transaction.atomic():
                user = get_user_model().objects.select_for_update().get(pk=token["user_id"])
                # Reparse under the lock so concurrent refresh requests cannot both succeed.
                token = RefreshToken(raw)
                check_account(user, token)
                token.blacklist()
                return session_response(user, issue_refresh(user))
        except (TokenError, KeyError, get_user_model().DoesNotExist, AuthenticationFailed):
            # Do not clear a cookie here: a delayed failed refresh could erase a newer login.
            return Response({"detail": "Your session has expired. Sign in again."}, status=401)


class LogoutView(AuthView):
    throttle_classes = []

    @extend_schema(
        request=None,
        responses=MessageSerializer,
        auth=[],
        description=(
            "Requires X-CSRFToken. Revokes the refresh cookie; access expires within five minutes."
        ),
    )
    def post(self, request):
        raw = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE)
        if raw:
            try:
                token = RefreshToken(raw)
                with transaction.atomic():
                    get_user_model().objects.select_for_update().get(pk=token["user_id"])
                    token.blacklist()
            except (TokenError, KeyError, get_user_model().DoesNotExist):
                pass
        return clear_refresh(Response({"detail": "Signed out."}))


class EmailRequestView(AuthView):
    throttle_classes = [EmailIPThrottle, EmailAddressThrottle]
    purpose = EmailToken.Purpose.RESET

    @extend_schema(
        request=EmailSerializer,
        responses=MessageSerializer,
        auth=[],
        description=(
            "Returns an account-independent acknowledgment. Requires X-CSRFToken. "
            "Verification requests do not send email when EMAIL_VERIFICATION_ENABLED is false."
        ),
    )
    def post(self, request):
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if self.purpose == EmailToken.Purpose.VERIFY and not settings.EMAIL_VERIFICATION_ENABLED:
            return Response({"detail": "Email verification is turned off. You can sign in."})
        user = (
            get_user_model()
            .objects.filter(
                email__iexact=serializer.validated_data["email"].strip(), is_active=True
            )
            .first()
        )
        if user and user.has_usable_password():
            services.send_account_email(user, self.purpose)
        return Response({"detail": services.GENERIC_EMAIL_MESSAGE})


class ResendVerificationView(EmailRequestView):
    purpose = EmailToken.Purpose.VERIFY


class VerifyEmailView(AuthView):
    @extend_schema(request=TokenSerializer, responses=MessageSerializer, auth=[])
    def post(self, request):
        serializer = TokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.consume_email_token(serializer.validated_data["token"], EmailToken.Purpose.VERIFY)
        return Response({"detail": "Email verified. You can now sign in."})


class ResetPasswordView(AuthView):
    @extend_schema(request=ResetPasswordSerializer, responses=MessageSerializer, auth=[])
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attrs = serializer.validated_data
        services.consume_email_token(
            attrs["token"],
            EmailToken.Purpose.RESET,
            {key: attrs[key] for key in ["password", "password_confirm"]},
        )
        return clear_refresh(
            Response({"detail": "Password reset. Sign in with your new password."})
        )


@method_decorator(csrf_protect, name="dispatch")
class ChangePasswordView(APIView):
    throttle_classes = [AuthThrottle]

    @extend_schema(request=ChangePasswordSerializer, responses=MessageSerializer)
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"user": request.user})
        serializer.is_valid(raise_exception=True)
        services.change_password(request.user.pk, serializer.validated_data)
        return clear_refresh(
            Response({"detail": "Password changed. Sign in again on all devices."})
        )


class MeView(APIView):
    @extend_schema(responses=UserSerializer)
    def get(self, request):
        response = Response(UserSerializer(request.user).data)
        response["Cache-Control"] = "no-store"
        return response


class IsApplicationAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user.is_authenticated
            and request.user.is_active
            and role_for(request.user) == "admin"
        )


class UserPagination(PageNumberPagination):
    page_size = 20


class AdminUserListView(ListAPIView):
    permission_classes = [IsApplicationAdmin]
    serializer_class = UserSerializer
    pagination_class = UserPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ["username", "email"]
    queryset = (
        get_user_model()
        .objects.select_related("security")
        .prefetch_related("groups")
        .order_by("id")
    )


class AdminUserInviteView(APIView):
    permission_classes = [IsApplicationAdmin]
    throttle_classes = [AuthThrottle]

    @extend_schema(
        request=AdminInviteSerializer,
        responses={
            201: UserSerializer,
            400: MessageSerializer,
            403: OpenApiResponse(description="Administrator role required"),
        },
        description=(
            "Creates an application account and sends a one-time password-setup invitation. "
            "The generated bootstrap password is never returned or shared."
        ),
    )
    def post(self, request):
        serializer = AdminInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invited = services.invite_account(request.user.pk, serializer.validated_data)
        return Response(UserSerializer(invited).data, status=status.HTTP_201_CREATED)


class AdminUserUpdateView(APIView):
    permission_classes = [IsApplicationAdmin]

    @extend_schema(
        request=AdminUpdateSerializer,
        responses={
            200: UserSerializer,
            400: MessageSerializer,
            403: OpenApiResponse(description="Administrator role required"),
        },
    )
    def patch(self, request, pk: int):
        serializer = AdminUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = services.update_account(request.user.pk, pk, serializer.validated_data)
        return Response(UserSerializer(target).data)
