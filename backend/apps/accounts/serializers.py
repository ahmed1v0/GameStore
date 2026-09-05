from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import ADMIN_GROUP


def role_for(user):
    if user.is_superuser:
        return "admin"
    # Filtering a prefetched manager issues another query for every serialized user.
    groups = getattr(user, "_prefetched_objects_cache", {}).get("groups")
    is_admin = (
        any(group.name == ADMIN_GROUP for group in groups)
        if groups is not None
        else user.groups.filter(name=ADMIN_GROUP).exists()
    )
    return "admin" if is_admin else "user"


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, dict):
            unknown = set(data) - set(self.fields)
            if unknown:
                raise serializers.ValidationError({key: "Unknown field." for key in unknown})
        return super().to_internal_value(data)


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    email_verified = serializers.SerializerMethodField()
    verification_required = serializers.SerializerMethodField()
    email_verification_enabled = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = [
            "id",
            "username",
            "email",
            "role",
            "is_active",
            "is_superuser",
            "email_verified",
            "verification_required",
            "email_verification_enabled",
            "date_joined",
        ]
        read_only_fields = fields

    def get_role(self, obj) -> str:
        return role_for(obj)

    def get_email_verified(self, obj) -> bool:
        return obj.security.email_verified_at is not None

    def get_verification_required(self, obj) -> bool:
        return settings.EMAIL_VERIFICATION_ENABLED and obj.security.verification_required

    def get_email_verification_enabled(self, obj) -> bool:
        return settings.EMAIL_VERIFICATION_ENABLED


class PasswordSerializer(StrictSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        user = self.context.get("user") or get_user_model()(
            username=attrs.get("username", ""), email=attrs.get("email", "")
        )
        try:
            validate_password(attrs["password"], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc
        return attrs


class SignupSerializer(PasswordSerializer):
    username = serializers.CharField(
        max_length=150, validators=get_user_model()._meta.get_field("username").validators
    )
    email = serializers.EmailField(max_length=254)

    def validate_username(self, value):
        if get_user_model().objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if get_user_model().objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account already uses this email.")
        return value


class LoginSerializer(StrictSerializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(trim_whitespace=False, write_only=True, max_length=128)


class EmailSerializer(StrictSerializer):
    email = serializers.EmailField(max_length=254)


class TokenSerializer(StrictSerializer):
    token = serializers.CharField(max_length=256)


class ResetPasswordSerializer(PasswordSerializer):
    token = serializers.CharField(max_length=256)


class ChangePasswordSerializer(PasswordSerializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)


class AdminUpdateSerializer(StrictSerializer):
    role = serializers.ChoiceField(choices=["admin", "user"], required=False)
    is_active = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Supply a role or active status.")
        return attrs


class MessageSerializer(serializers.Serializer):
    detail = serializers.CharField()


class SignupResponseSerializer(MessageSerializer):
    verification_required = serializers.BooleanField()


class SessionSerializer(serializers.Serializer):
    access = serializers.CharField()
    user = UserSerializer()


class CsrfSerializer(serializers.Serializer):
    csrfToken = serializers.CharField()
    email_verification_enabled = serializers.BooleanField()
