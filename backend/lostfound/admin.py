from django.contrib import admin

from .models import LostFoundItem


@admin.register(LostFoundItem)
class LostFoundItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'item_type', 'status', 'location', 'reported_by', 'found_by', 'created_at')
    list_filter = ('item_type', 'status', 'created_at')
    search_fields = ('title', 'description', 'location', 'reported_by__username', 'found_by__username')

# Register your models here.
