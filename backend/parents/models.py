from django.conf import settings
from django.db import models
from students.models import Student


class ParentProfile(models.Model):
    RELATION_CHOICES = [
        ('father', 'Father'),
        ('mother', 'Mother'),
        ('guardian', 'Guardian'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='parent_profile',
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='parent_profiles',
    )
    relation = models.CharField(max_length=20, choices=RELATION_CHOICES, default='guardian')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ['user', 'student']

    def __str__(self):
        return f"{self.user.username} -> {self.student.student_id}"
