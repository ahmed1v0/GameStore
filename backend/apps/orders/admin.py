from django.contrib import admin

from apps.orders.models import Order


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "product_title", "unit_price", "product_location", "created_at")
    list_filter = ("product_location", "created_at")
    search_fields = ("product_title", "user__username")
    readonly_fields = (
        "user",
        "product",
        "product_title",
        "unit_price",
        "product_location",
        "created_at",
    )
