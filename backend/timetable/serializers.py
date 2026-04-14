from rest_framework import serializers
from .models import ClassSchedule, LessonPlan


class ClassScheduleSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.get_full_name', read_only=True)

    class Meta:
        model = ClassSchedule
        fields = [
            'id', 'class_name', 'section', 'day_of_week', 'period',
            'subject', 'subject_name', 'teacher', 'teacher_name',
            'start_time', 'end_time', 'room', 'is_active'
        ]


class LessonPlanSerializer(serializers.ModelSerializer):
    schedule_details = ClassScheduleSerializer(source='schedule', read_only=True)

    class Meta:
        model = LessonPlan
        fields = [
            'id', 'schedule', 'schedule_details', 'lesson_date', 'topic',
            'objectives', 'materials', 'homework', 'status',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']
