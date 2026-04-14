from django.db import models
from django.contrib.auth import get_user_model
from students.models import Student

User = get_user_model()


class Hostel(models.Model):
    """
    Hostel model for managing hostel information
    """
    name = models.CharField(max_length=100, unique=True)
    address = models.TextField()
    capacity = models.PositiveIntegerField()
    current_occupancy = models.PositiveIntegerField(default=0)
    warden_name = models.CharField(max_length=100)
    warden_contact = models.CharField(max_length=15)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name
    
    @property
    def available_beds(self):
        return self.capacity - self.current_occupancy
    
    class Meta:
        ordering = ['name']


class Room(models.Model):
    """
    Room model for managing hostel rooms
    """
    ROOM_TYPES = [
        ('single', 'Single'),
        ('double', 'Double'),
        ('triple', 'Triple'),
        ('quad', 'Quad'),
    ]
    
    hostel = models.ForeignKey(Hostel, on_delete=models.CASCADE, related_name='rooms')
    room_number = models.CharField(max_length=10)
    room_type = models.CharField(max_length=10, choices=ROOM_TYPES)
    capacity = models.PositiveIntegerField()
    current_occupancy = models.PositiveIntegerField(default=0)
    monthly_rent = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.hostel.name} - Room {self.room_number}"
    
    @property
    def available_beds(self):
        return self.capacity - self.current_occupancy
    
    class Meta:
        unique_together = ['hostel', 'room_number']
        ordering = ['hostel', 'room_number']


class HostelAllocation(models.Model):
    """
    Hostel allocation model for managing student hostel assignments
    """
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='hostel_allocation')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='allocations')
    allocated_date = models.DateField()
    monthly_rent = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.student.student_id} - {self.room}"
    
    class Meta:
        ordering = ['-allocated_date']


class HostelFeeRecord(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
    ]

    PAYMENT_METHODS = [
        ('cash', 'Cash'),
        ('bank', 'Bank Transfer'),
        ('online', 'Online'),
        ('card', 'Card'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='hostel_fees')
    room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_records')
    allocation = models.ForeignKey(HostelAllocation, on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_records')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHODS, blank=True)
    paid_on = models.DateField(null=True, blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='hostel_fee_records')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-due_date', '-created_at']

    def __str__(self):
        return f"{self.student.student_id} - {self.amount}"


class HostelMaintenanceRequest(models.Model):
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='maintenance_requests')
    issue = models.CharField(max_length=255)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending')
    reported_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='hostel_maintenance_reports')
    is_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='hostel_maintenance_approvals')
    approved_on = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    reported_on = models.DateTimeField(auto_now_add=True)
    resolved_on = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['-reported_on']

    def __str__(self):
        return f"{self.room} - {self.issue}"


class HostelRoomRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='hostel_room_requests')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='room_requests')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    note = models.TextField(blank=True, null=True)
    requested_on = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='hostel_room_request_reviews')
    reviewed_on = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-requested_on']

    def __str__(self):
        return f"{self.student.student_id} -> {self.room} ({self.status})"


class HostelLeaveRequest(models.Model):
    STATUS_CHOICES = [
        ('pending_warden', 'Pending Warden'),
        ('pending_parent', 'Pending Parent'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='hostel_leave_requests')
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_warden')

    warden_note = models.TextField(blank=True, null=True)
    warden_action_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hostel_leave_warden_actions'
    )
    warden_action_on = models.DateTimeField(null=True, blank=True)

    parent_note = models.TextField(blank=True, null=True)
    parent_action_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hostel_leave_parent_actions'
    )
    parent_action_on = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.student.student_id} leave {self.start_date} to {self.end_date}"


class HostelMessMenu(models.Model):
    date = models.DateField(unique=True)
    breakfast = models.TextField(blank=True, null=True)
    lunch = models.TextField(blank=True, null=True)
    dinner = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='hostel_mess_menus')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"Mess Menu {self.date}"
