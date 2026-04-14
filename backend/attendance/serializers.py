from rest_framework import serializers
from .models import Subject, Attendance, AttendanceReport, AttendanceSession, LeaveRequest


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = '__all__'


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.get_full_name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    
    class Meta:
        model = Attendance
        fields = '__all__'


class AttendanceSessionSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    total_students = serializers.SerializerMethodField()
    present_count = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = '__all__'

    def get_total_students(self, obj):
        # If enrollment model exists, replace with actual class roster size.
        return obj.attendances.values('student_id').distinct().count()

    def get_present_count(self, obj):
        return obj.attendances.filter(status__in=['present', 'late']).count()

class AttendanceReportSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    
    class Meta:
        model = AttendanceReport
        fields = '__all__'


class LeaveRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_class = serializers.CharField(source='student.current_class', read_only=True)
    student_section = serializers.CharField(source='student.current_section', read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = [
            'id',
            'student',
            'student_name',
            'student_id',
            'student_class',
            'student_section',
            'start_date',
            'end_date',
            'reason',
            'attachment',
            'attachment_url',
            'status',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'rejection_reason',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'student',
            'status',
            'approved_by',
            'approved_at',
            'created_at',
            'updated_at',
        ]

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None

    def get_attachment_url(self, obj):
        try:
            if obj.attachment:
                request = self.context.get('request') if hasattr(self, 'context') else None
                url = obj.attachment.url
                if request:
                    return request.build_absolute_uri(url)
                return url
        except Exception:
            return None
        return None


class LeaveRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveRequest
        fields = ['start_date', 'end_date', 'reason', 'attachment']

    def validate(self, attrs):
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({'end_date': 'End date cannot be before start date.'})
        return attrs
