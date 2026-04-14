from django.db import models
from django.conf import settings
from students.models import Student
from teachers.models import Teacher


class ChatThread(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='chat_threads')
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='chat_threads')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['student', 'teacher']
        ordering = ['-updated_at']

    def __str__(self):
        return f"Thread {self.student} <> {self.teacher}"


class ChatMessage(models.Model):
    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_messages')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message {self.id} in {self.thread_id}"


class ClassAnnouncement(models.Model):
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='class_announcements')
    title = models.CharField(max_length=200)
    message = models.TextField()
    target_class = models.CharField(max_length=20)
    target_section = models.CharField(max_length=10, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.target_class}{self.target_section or ''})"

# Create your models here.
