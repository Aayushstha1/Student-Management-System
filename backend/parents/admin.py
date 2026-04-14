from django.contrib import admin
from .models import ParentProfile


@admin.register(ParentProfile)
class ParentProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'student', 'relation', 'created_at')
    search_fields = ('user__username', 'student__student_id', 'student__user__first_name', 'student__user__last_name')
    list_filter = ('relation',)
