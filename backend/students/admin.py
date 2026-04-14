from django.contrib import admin
from .models import Student, StudentPasswordResetRequest, StudentEmailChangeRequest, ConsentRequest


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    """
    Admin interface for Student management
    """
    list_display = (
        'student_id', 'user', 'admission_number', 'current_class', 
        'current_section', 'roll_number', 'is_active', 'created_at'
    )
    list_filter = ('current_class', 'current_section', 'gender', 'is_active', 'created_at')
    search_fields = ('student_id', 'admission_number', 'user__username', 'user__first_name', 'user__last_name')
    readonly_fields = ('student_id', 'admission_number', 'qr_code', 'created_at', 'updated_at')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('user', 'student_id', 'admission_number', 'admission_date')
        }),
        ('Personal Information', {
            'fields': ('date_of_birth', 'gender', 'blood_group', 'father_name', 'mother_name', 'guardian_contact')
        }),
        ('Academic Information', {
            'fields': ('current_class', 'current_section', 'roll_number')
        }),
        ('System Information', {
            'fields': ('qr_code', 'is_active', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')


@admin.register(StudentPasswordResetRequest)
class StudentPasswordResetRequestAdmin(admin.ModelAdmin):
    list_display = (
        'username', 'class_name', 'father_name', 'email',
        'status', 'requested_at', 'reviewed_at', 'student'
    )
    list_filter = ('status', 'requested_at')
    search_fields = ('username', 'class_name', 'father_name', 'email', 'student__student_id')
    readonly_fields = ('requested_at', 'reviewed_at', 'reviewed_by')


@admin.register(StudentEmailChangeRequest)
class StudentEmailChangeRequestAdmin(admin.ModelAdmin):
    list_display = (
        'student', 'new_email', 'status', 'requested_at', 'reviewed_at', 'reviewed_by'
    )
    list_filter = ('status', 'requested_at')
    search_fields = ('student__student_id', 'student__user__username', 'new_email')
    readonly_fields = ('requested_at', 'reviewed_at', 'reviewed_by')


@admin.register(ConsentRequest)
class ConsentRequestAdmin(admin.ModelAdmin):
    list_display = ('student', 'request_type', 'title', 'status', 'created_at', 'reviewed_by')
    list_filter = ('request_type', 'status', 'created_at')
    search_fields = ('student__student_id', 'title', 'details')
