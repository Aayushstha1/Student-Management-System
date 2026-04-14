from django.contrib import admin
from .models import ServiceRequest


@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'student', 'request_type', 'status', 'assigned_role', 'created_at')
    list_filter = ('request_type', 'status', 'assigned_role', 'created_at')
    search_fields = ('student__student_id', 'student__user__first_name', 'student__user__last_name', 'title')
    readonly_fields = ('created_at', 'updated_at', 'handled_at')
