from rest_framework import serializers
import re
from .models import (
    AcademicYear,
    Semester,
    Exam,
    Result,
    ClassSubjectAssignment,
    ExamRoom,
    ExamSeatAssignment,
)
from .conflicts import get_exam_conflicts_for_candidate
from .seat_planning import build_seat_plan_summary, build_user_seat_assignment
from .utils import normalize_class_section


class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = '__all__'


class SemesterSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    
    class Meta:
        model = Semester
        fields = '__all__'


class ExamSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    seat_plan_summary = serializers.SerializerMethodField()
    my_seat_assignment = serializers.SerializerMethodField()
    
    class Meta:
        model = Exam
        fields = '__all__'

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)
        class_name = attrs.get('class_name', getattr(instance, 'class_name', ''))
        section = attrs.get('section', getattr(instance, 'section', ''))
        if class_name or section:
            class_name, section = normalize_class_section(class_name, section)
            attrs['class_name'] = class_name
            attrs['section'] = section

        total_marks = attrs.get('total_marks', getattr(instance, 'total_marks', None))
        passing_marks = attrs.get('passing_marks', getattr(instance, 'passing_marks', None))
        start_time = attrs.get('start_time', getattr(instance, 'start_time', None))
        end_time = attrs.get('end_time', getattr(instance, 'end_time', None))
        exam_date = attrs.get('exam_date', getattr(instance, 'exam_date', None))
        subject = attrs.get('subject', getattr(instance, 'subject', None))

        if total_marks is not None and passing_marks is not None and passing_marks > total_marks:
            raise serializers.ValidationError({'passing_marks': 'Passing marks cannot be greater than total marks.'})
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError({'end_time': 'End time must be after start time.'})

        if subject and class_name and exam_date:
            conflicts = get_exam_conflicts_for_candidate(
                subject_id=getattr(subject, 'id', subject),
                class_name=class_name,
                section=section,
                exam_date=exam_date,
                start_time=start_time,
                end_time=end_time,
                instance=instance,
            )
            if conflicts:
                raise serializers.ValidationError({
                    'detail': 'Exam conflicts detected for this schedule.',
                    'conflicts': conflicts,
                })
        return attrs

    def get_seat_plan_summary(self, obj):
        return build_seat_plan_summary(obj)

    def get_my_seat_assignment(self, obj):
        request = self.context.get('request')
        if not request or getattr(request.user, 'role', None) not in ['student', 'parent']:
            return None
        return build_user_seat_assignment(obj, request.user)


class ResultSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_class = serializers.CharField(source='student.current_class', read_only=True)
    student_section = serializers.CharField(source='student.current_section', read_only=True)
    exam_name = serializers.CharField(source='exam.name', read_only=True)
    subject_name = serializers.CharField(source='exam.subject.name', read_only=True)
    subject_code = serializers.CharField(source='exam.subject.code', read_only=True)
    total_marks = serializers.CharField(source='exam.total_marks', read_only=True)
    published_by_name = serializers.CharField(source='published_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    
    class Meta:
        model = Result
        fields = '__all__'
        read_only_fields = ('published_by', 'approved_by', 'published_at', 'approved_at', 'grade')


class ClassSubjectAssignmentSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.get_full_name', read_only=True)

    class Meta:
        model = ClassSubjectAssignment
        fields = '__all__'
        read_only_fields = ('created_at',)

    def validate(self, attrs):
        class_name = attrs.get('class_name')
        section = attrs.get('section')
        if class_name:
            value = str(class_name).strip()
            value = re.sub(r'^(class|cls)\s*[-:_]*\s*', '', value, flags=re.IGNORECASE)
            value = re.sub(r'[/_-]+', ' ', value)
            value = re.sub(r'(\d)([A-Za-z])', r'\1 \2', value)
            value = re.sub(r'\s+', ' ', value).strip()

            parts = value.split(' ')
            if value[:1].isdigit() and len(parts) > 1 and (section is None or str(section).strip() == ''):
                last = parts[-1]
                if re.fullmatch(r'[A-Za-z]{1,3}', last):
                    attrs['class_name'] = ' '.join(parts[:-1]).strip()
                    attrs['section'] = last.upper()
                else:
                    attrs['class_name'] = value
            else:
                attrs['class_name'] = value

        if section is not None and 'section' not in attrs:
            attrs['section'] = str(section).strip().upper()
        return attrs


class ExamRoomSerializer(serializers.ModelSerializer):
    grid_capacity = serializers.IntegerField(read_only=True)

    class Meta:
        model = ExamRoom
        fields = '__all__'
        read_only_fields = ('created_at', 'grid_capacity')

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)
        rows = attrs.get('rows', getattr(instance, 'rows', 0))
        columns = attrs.get('columns', getattr(instance, 'columns', 0))
        capacity = attrs.get('capacity', getattr(instance, 'capacity', 0))

        if rows <= 0:
            raise serializers.ValidationError({'rows': 'Rows must be greater than zero.'})
        if columns <= 0:
            raise serializers.ValidationError({'columns': 'Columns must be greater than zero.'})
        if capacity <= 0:
            raise serializers.ValidationError({'capacity': 'Capacity must be greater than zero.'})
        if capacity > rows * columns:
            raise serializers.ValidationError({'capacity': 'Capacity cannot exceed rows x columns.'})
        return attrs


class ExamSeatAssignmentSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source='room.name', read_only=True)
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    roll_number = serializers.CharField(source='student.roll_number', read_only=True)
    class_name = serializers.CharField(source='student.current_class', read_only=True)
    section = serializers.CharField(source='student.current_section', read_only=True)
    exam_name = serializers.CharField(source='exam.name', read_only=True)
    subject_name = serializers.CharField(source='exam.subject.name', read_only=True)

    class Meta:
        model = ExamSeatAssignment
        fields = '__all__'
        read_only_fields = ('assigned_at', 'assigned_by')
