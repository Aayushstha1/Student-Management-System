from rest_framework import serializers
from .models import NoteCategory, Note, NoteRating, NoteBookmark, NoteComment, NoteView


class NoteCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteCategory
        fields = '__all__'


class NoteSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    
    class Meta:
        model = Note
        fields = '__all__'
        read_only_fields = ['uploaded_by', 'view_count', 'download_count', 'created_at', 'updated_at']
        extra_kwargs = {
            'content': {'required': False, 'allow_blank': True},
        }


class NoteRatingSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = NoteRating
        fields = '__all__'


class NoteBookmarkSerializer(serializers.ModelSerializer):
    note_title = serializers.CharField(source='note.title', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = NoteBookmark
        fields = '__all__'


class NoteCommentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = NoteComment
        fields = '__all__'


class NoteViewSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    roll_number = serializers.CharField(source='student.roll_number', read_only=True)
    current_class = serializers.CharField(source='student.current_class', read_only=True)
    current_section = serializers.CharField(source='student.current_section', read_only=True)

    class Meta:
        model = NoteView
        fields = [
            'id', 'note', 'student',
            'student_name', 'student_id', 'roll_number', 'current_class', 'current_section',
            'view_count', 'first_viewed_at', 'last_viewed_at'
        ]
        read_only_fields = ['note', 'student', 'view_count', 'first_viewed_at', 'last_viewed_at']
