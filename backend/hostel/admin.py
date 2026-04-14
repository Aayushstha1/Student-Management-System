from django.contrib import admin
from .models import (
    Hostel,
    Room,
    HostelAllocation,
    HostelFeeRecord,
    HostelMaintenanceRequest,
    HostelRoomRequest,
    HostelLeaveRequest,
    HostelMessMenu,
)


@admin.register(Hostel)
class HostelAdmin(admin.ModelAdmin):
    """
    Admin interface for Hostel management
    """
    list_display = ('name', 'capacity', 'current_occupancy', 'available_beds', 'warden_name', 'is_active')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'warden_name')
    readonly_fields = ('current_occupancy', 'created_at')


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    """
    Admin interface for Room management
    """
    list_display = ('room_number', 'hostel', 'room_type', 'capacity', 'current_occupancy', 'available_beds', 'monthly_rent', 'is_active')
    list_filter = ('hostel', 'room_type', 'is_active')
    search_fields = ('room_number', 'hostel__name')
    readonly_fields = ('current_occupancy', 'created_at')
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('hostel')


@admin.register(HostelAllocation)
class HostelAllocationAdmin(admin.ModelAdmin):
    """
    Admin interface for Hostel Allocation management
    """
    list_display = ('student', 'room', 'allocated_date', 'monthly_rent', 'is_active')
    list_filter = ('is_active', 'allocated_date', 'room__hostel')
    search_fields = ('student__student_id', 'student__user__first_name', 'student__user__last_name')
    readonly_fields = ('created_at',)
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('student__user', 'room__hostel')


@admin.register(HostelFeeRecord)
class HostelFeeRecordAdmin(admin.ModelAdmin):
    list_display = ('student', 'room', 'amount', 'due_date', 'status', 'payment_method', 'paid_on')
    list_filter = ('status', 'payment_method', 'due_date')
    search_fields = ('student__student_id', 'student__user__first_name', 'student__user__last_name')
    readonly_fields = ('created_at',)


@admin.register(HostelMaintenanceRequest)
class HostelMaintenanceRequestAdmin(admin.ModelAdmin):
    list_display = ('room', 'issue', 'priority', 'status', 'reported_on', 'resolved_on')
    list_filter = ('priority', 'status', 'reported_on')
    search_fields = ('room__room_number', 'issue')
    readonly_fields = ('reported_on',)


@admin.register(HostelRoomRequest)
class HostelRoomRequestAdmin(admin.ModelAdmin):
    list_display = ('student', 'room', 'status', 'requested_on', 'reviewed_on')
    list_filter = ('status', 'requested_on')
    search_fields = ('student__student_id', 'student__user__first_name', 'student__user__last_name', 'room__room_number')
    readonly_fields = ('requested_on', 'reviewed_on')


@admin.register(HostelLeaveRequest)
class HostelLeaveRequestAdmin(admin.ModelAdmin):
    list_display = ('student', 'start_date', 'end_date', 'status', 'warden_action_on', 'parent_action_on')
    list_filter = ('status', 'start_date', 'end_date')
    search_fields = ('student__student_id', 'student__user__first_name', 'student__user__last_name')
    readonly_fields = ('created_at', 'updated_at', 'warden_action_on', 'parent_action_on')


@admin.register(HostelMessMenu)
class HostelMessMenuAdmin(admin.ModelAdmin):
    list_display = ('date', 'breakfast', 'lunch', 'dinner', 'created_by')
    list_filter = ('date',)
    search_fields = ('breakfast', 'lunch', 'dinner', 'notes')
    readonly_fields = ('created_at',)
