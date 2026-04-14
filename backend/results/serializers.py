from rest_framework import serializers
import re
from .models import AcademicYear, Semester, Exam, Result, ClassSubjectAssignment
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
    
    class Meta:
        model = Exam
        fields = '__all__'

    def validate(self, attrs):
        class_name = attrs.get('class_name', '')
        section = attrs.get('section', '')
        if class_name or section:
            class_name, section = normalize_class_section(class_name, section)
            attrs['class_name'] = class_name
            attrs['section'] = section
        return attrs


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

