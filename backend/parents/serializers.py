from rest_framework import serializers
from .models import ParentProfile


class ParentProfileSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()

    class Meta:
        model = ParentProfile
        fields = ['id', 'relation', 'student']

    def get_student(self, obj):
        student = obj.student
        user = getattr(student, 'user', None)
        return {
            'id': student.id,
            'student_id': student.student_id,
            'admission_number': student.admission_number,
            'name': user.get_full_name() if user else '',
            'first_name': getattr(user, 'first_name', ''),
            'last_name': getattr(user, 'last_name', ''),
            'class': student.current_class,
            'section': student.current_section,
            'roll_number': student.roll_number,
        }
