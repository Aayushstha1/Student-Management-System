from django.db import models
from django.contrib.auth import get_user_model
from students.models import Student

User = get_user_model()


class ServiceRequest(models.Model):
    REQUEST_TYPES = [
        ('book_request', 'Book Request'),
        ('hostel_room_change', 'Hostel Room Change'),
        ('leave_request', 'Leave Request'),
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
    ]

    ASSIGNED_ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('librarian', 'Librarian'),
        ('hostel_warden', 'Hostel Warden'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='service_requests')
    request_type = models.CharField(max_length=30, choices=REQUEST_TYPES)
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    payload = models.JSONField(default=dict, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    assigned_role = models.CharField(max_length=20, choices=ASSIGNED_ROLE_CHOICES, default='admin')

    handled_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='handled_service_requests')
    handled_at = models.DateTimeField(null=True, blank=True)
    response_note = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.student.student_id} - {self.request_type} ({self.status})"
