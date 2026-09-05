from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.utils import get_md5_hash_password


def check_account(user, token=None):
    security = user.security
    if not user.is_active:
        raise AuthenticationFailed("This account is unavailable.")
    if (
        settings.EMAIL_VERIFICATION_ENABLED
        and security.verification_required
        and not security.email_verified_at
    ):
        raise AuthenticationFailed("Verify your email before signing in.", "email_unverified")
    if token is not None and (
        token.get("session_version") != security.session_version
        or token.get("hash_password") != get_md5_hash_password(user.password)
    ):
        raise AuthenticationFailed("Your session has expired. Sign in again.")


def issue_refresh(user):
    check_account(user)
    token = RefreshToken.for_user(user)
    token["session_version"] = user.security.session_version
    return token


class AccountJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        check_account(user, validated_token)
        return user
