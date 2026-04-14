from django.contrib import admin
from .models import ClassSchedule, LessonPlan


@admin.register(ClassSchedule)
class ClassScheduleAdmin(admin.ModelAdmin):
    list_display = ('class_name', 'section', 'day_of_week', 'period', 'subject', 'teacher', 'start_time', 'end_time', 'is_active')
    list_filter = ('class_name', 'section', 'day_of_week', 'is_active')
    search_fields = ('class_name', 'section', 'subject__name', 'teacher__user__first_name', 'teacher__user__last_name')


@admin.register(LessonPlan)
class LessonPlanAdmin(admin.ModelAdmin):
    list_display = ('lesson_date', 'topic', 'status', 'schedule')
    list_filter = ('status', 'lesson_date')
    search_fields = ('topic', 'schedule__class_name', 'schedule__section', 'schedule__subject__name')
