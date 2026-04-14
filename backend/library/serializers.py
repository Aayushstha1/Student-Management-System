from rest_framework import serializers
import re
from .models import Book, BookIssue, Fine, BookView


class BookSerializer(serializers.ModelSerializer):
    cover_image_url = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)

    class Meta:
        model = Book
        fields = '__all__'
        extra_kwargs = {
            'isbn': {'required': False, 'allow_null': True, 'allow_blank': True},
            'publisher': {'required': False, 'allow_null': True, 'allow_blank': True},
            'shelf_number': {'required': False, 'allow_null': True, 'allow_blank': True},
            'description': {'required': False, 'allow_null': True, 'allow_blank': True},
            'class_name': {'required': False, 'allow_null': True, 'allow_blank': True},
        }

    def validate(self, attrs):
        copy_numbers = attrs.get('copy_numbers')
        if copy_numbers is not None:
            raw = str(copy_numbers)
            tokens = []
            for chunk in raw.replace('\n', ',').replace(';', ',').split(','):
                chunk = chunk.strip()
                if not chunk:
                    continue
                for sub in chunk.split():
                    sub = sub.strip()
                    if sub:
                        tokens.append(sub)
            # De-duplicate while preserving order
            seen = set()
            unique_tokens = []
            for t in tokens:
                if t in seen:
                    continue
                seen.add(t)
                unique_tokens.append(t)
            attrs['copy_numbers'] = '\n'.join(unique_tokens) if unique_tokens else None

        # Normalize empty strings to None for nullable fields
        for key in ['isbn', 'publisher', 'shelf_number', 'description', 'class_name']:
            if key in attrs and attrs[key] == '':
                attrs[key] = None
        if 'publication_year' in attrs and attrs['publication_year'] in ['', None]:
            attrs['publication_year'] = None
        if 'class_name' in attrs and attrs['class_name']:
            class_value = str(attrs['class_name']).strip()
            # Remove leading "class" or "cls" prefixes
            class_value = re.sub(r'^(class|cls)\s*[-:_]*\s*', '', class_value, flags=re.IGNORECASE)
            # Normalize separators to spaces
            class_value = re.sub(r'[/_-]+', ' ', class_value)
            # Insert space between number and letter (e.g., 12A -> 12 A)
            class_value = re.sub(r'(\\d)([A-Za-z])', r'\\1 \\2', class_value)
            # Collapse whitespace
            class_value = re.sub(r'\\s+', ' ', class_value).strip()
            attrs['class_name'] = class_value or None
        # If book is fixed/required, class_name must be set
        is_fixed = attrs.get('is_fixed')
        if self.instance is not None and is_fixed is None:
            is_fixed = self.instance.is_fixed
        class_name = attrs.get('class_name')
        if self.instance is not None and class_name is None:
            class_name = self.instance.class_name
        if is_fixed and not class_name:
            raise serializers.ValidationError({'class_name': 'Class is required for fixed books.'})
        subject = attrs.get('subject')
        if self.instance is not None and subject is None:
            subject = self.instance.subject
        if is_fixed and not subject:
            raise serializers.ValidationError({'subject': 'Subject is required for fixed books.'})
        return attrs

    def create(self, validated_data):
        copy_numbers = validated_data.get('copy_numbers')
        if copy_numbers:
            count = len([n for n in copy_numbers.split('\n') if n.strip()])
            if count > 0:
                validated_data['total_copies'] = count
                if 'available_copies' not in validated_data or validated_data['available_copies'] is None:
                    validated_data['available_copies'] = count
                else:
                    validated_data['available_copies'] = min(validated_data['available_copies'], count)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        copy_numbers = validated_data.get('copy_numbers')
        if copy_numbers is not None:
            count = len([n for n in copy_numbers.split('\n') if n.strip()])
            if count > 0:
                validated_data['total_copies'] = count
                if 'available_copies' not in validated_data or validated_data['available_copies'] is None:
                    validated_data['available_copies'] = min(instance.available_copies or count, count)
                else:
                    validated_data['available_copies'] = min(validated_data['available_copies'], count)
        return super().update(instance, validated_data)

    def get_cover_image_url(self, obj):
        try:
            if not obj.cover_image:
                return None
            request = self.context.get('request') if hasattr(self, 'context') else None
            url = obj.cover_image.url
            if request:
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return None


class BookIssueSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.get_full_name', read_only=True)
    teacher_id = serializers.CharField(source='teacher.employee_id', read_only=True)
    book_title = serializers.CharField(source='book.title', read_only=True)

    class Meta:
        model = BookIssue
        fields = '__all__'


class FineSerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(source='book_issue.book.title', read_only=True)

    class Meta:
        model = Fine
        fields = '__all__'


# ✅ NEW SERIALIZER
class BookViewSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    book_title = serializers.CharField(source='book.title', read_only=True)

    class Meta:
        model = BookView
        fields = ['id', 'book_title', 'student_name', 'student_id', 'viewed_at']
