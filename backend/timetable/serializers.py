from rest_framework import serializers
from .models import ClassSchedule, LessonPlan
from .conflicts import get_schedule_conflicts_for_candidate


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

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)
        class_name = attrs.get('class_name', getattr(instance, 'class_name', ''))
        section = attrs.get('section', getattr(instance, 'section', ''))
        day_of_week = attrs.get('day_of_week', getattr(instance, 'day_of_week', None))
        start_time = attrs.get('start_time', getattr(instance, 'start_time', None))
        end_time = attrs.get('end_time', getattr(instance, 'end_time', None))
        teacher = attrs.get('teacher', getattr(instance, 'teacher', None))
        room = attrs.get('room', getattr(instance, 'room', ''))

        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError({'end_time': 'End time must be after start time.'})

        if class_name and day_of_week is not None and start_time and end_time:
            conflicts = get_schedule_conflicts_for_candidate(
                class_name=class_name,
                section=section,
                day_of_week=day_of_week,
                start_time=start_time,
                end_time=end_time,
                teacher_id=getattr(teacher, 'id', teacher),
                room=room,
                instance=instance,
            )
            if conflicts:
                raise serializers.ValidationError({
                    'detail': 'Schedule conflicts detected for this time window.',
                    'conflicts': conflicts,
                })

        return attrs


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
