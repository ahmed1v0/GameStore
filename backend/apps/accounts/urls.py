from django.urls import path

from . import views

urlpatterns = [
    path("auth/csrf", views.CsrfView.as_view(), name="auth-csrf"),
    path("auth/signup", views.SignupView.as_view(), name="auth-signup"),
    path("auth/login", views.LoginView.as_view(), name="token_obtain_pair"),
    path("auth/refresh", views.RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/me", views.MeView.as_view(), name="auth-me"),
    path("auth/verify-email", views.VerifyEmailView.as_view(), name="auth-verify-email"),
    path(
        "auth/resend-verification",
        views.ResendVerificationView.as_view(),
        name="auth-resend-verification",
    ),
    path("auth/forgot-password", views.EmailRequestView.as_view(), name="auth-forgot-password"),
    path("auth/reset-password", views.ResetPasswordView.as_view(), name="auth-reset-password"),
    path("auth/change-password", views.ChangePasswordView.as_view(), name="auth-change-password"),
    path("admin/users", views.AdminUserListView.as_view(), name="admin-users"),
    path("admin/users/<int:pk>", views.AdminUserUpdateView.as_view(), name="admin-user-update"),
]
