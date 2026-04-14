from django.conf import settings
from django.db import models
from attendance.models import Subject
from teachers.models import Teacher


class ClassSchedule(models.Model):
    DAY_CHOICES = [
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    ]

    class_name = models.CharField(max_length=20)
    section = models.CharField(max_length=10, blank=True, default='')
    day_of_week = models.IntegerField(choices=DAY_CHOICES)
    period = models.PositiveIntegerField(default=1)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='class_schedules')
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name='class_schedules')
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['class_name', 'section', 'day_of_week', 'period']
        unique_together = ['class_name', 'section', 'day_of_week', 'period']

    def __str__(self):
        section_part = f" {self.section}" if self.section else ''
        return f"{self.class_name}{section_part} - {self.get_day_of_week_display()} P{self.period}"


class LessonPlan(models.Model):
    STATUS_CHOICES = [
        ('planned', 'Planned'),
        ('completed', 'Completed'),
        ('skipped', 'Skipped'),
    ]

    schedule = models.ForeignKey(ClassSchedule, on_delete=models.CASCADE, related_name='lesson_plans')
    lesson_date = models.DateField()
    topic = models.CharField(max_length=200)
    objectives = models.TextField(blank=True)
    materials = models.TextField(blank=True)
    homework = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planned')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='lesson_plans',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-lesson_date', 'schedule__class_name', 'schedule__section', 'schedule__period']
        unique_together = ['schedule', 'lesson_date']

    def __str__(self):
        return f"{self.schedule} - {self.lesson_date}: {self.topic}"
