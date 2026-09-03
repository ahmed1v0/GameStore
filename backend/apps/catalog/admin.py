from django.contrib import admin

from apps.catalog.models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "price", "location", "updated_at")
    list_filter = ("location",)
    search_fields = ("title",)
