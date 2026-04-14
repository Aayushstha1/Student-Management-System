from django.conf import settings
from django.db import models


class LostFoundItem(models.Model):
    ITEM_TYPES = [
        ('lost', 'Lost'),
        ('found', 'Found'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('found', 'Found'),
        ('returned', 'Returned'),
    ]

    item_type = models.CharField(max_length=10, choices=ITEM_TYPES, default='lost')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='lostfound_reports',
    )
    found_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='lostfound_founds',
    )
    found_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.item_type})"

# Create your models here.
