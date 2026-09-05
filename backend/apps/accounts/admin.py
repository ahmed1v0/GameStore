from django.contrib import admin

from .models import AccountAudit, AccountSecurity


@admin.register(AccountSecurity)
class AccountSecurityAdmin(admin.ModelAdmin):
    list_display = ["user", "verification_required", "email_verified_at", "session_version"]
    readonly_fields = ["user", "verification_required", "email_verified_at", "session_version"]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AccountAudit)
class AccountAuditAdmin(admin.ModelAdmin):
    list_display = ["actor", "target", "created_at"]
    readonly_fields = ["actor", "target", "before", "after", "created_at"]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
