from rest_framework import serializers
from .models import ServiceRequest


ROLE_BY_TYPE = {
    'book_request': 'librarian',
    'hostel_room_change': 'hostel_warden',
    'leave_request': 'admin',
    'other': 'admin',
}


class ServiceRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_class = serializers.CharField(source='student.current_class', read_only=True)
    student_section = serializers.CharField(source='student.current_section', read_only=True)
    handled_by_name = serializers.CharField(source='handled_by.get_full_name', read_only=True)

    class Meta:
        model = ServiceRequest
        fields = '__all__'
        read_only_fields = [
            'student',
            'status',
            'assigned_role',
            'handled_by',
            'handled_at',
            'response_note',
            'created_at',
            'updated_at',
        ]


class ServiceRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceRequest
        fields = ['request_type', 'title', 'description', 'payload']

    def validate_request_type(self, value):
        if value not in dict(ServiceRequest.REQUEST_TYPES):
            raise serializers.ValidationError('Invalid request type.')
        return value

    def create(self, validated_data):
        student = validated_data.pop('student', None) or self.context.get('student')
        if not student:
            raise serializers.ValidationError({'detail': 'Student profile not found.'})
        request_type = validated_data.get('request_type')
        assigned_role = ROLE_BY_TYPE.get(request_type, 'admin')
        return ServiceRequest.objects.create(
            student=student,
            assigned_role=assigned_role,
            **validated_data
        )


class ServiceRequestRespondSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ServiceRequest.STATUS_CHOICES)
    response_note = serializers.CharField(allow_blank=True, required=False)
