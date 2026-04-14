from rest_framework import serializers
from .models import ChatThread, ChatMessage, ClassAnnouncement


class ChatThreadSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.id', read_only=True)
    teacher_id = serializers.CharField(source='teacher.id', read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatThread
        fields = [
            'id', 'student', 'teacher', 'student_id', 'teacher_id',
            'student_name', 'teacher_name', 'created_at', 'updated_at',
            'last_message', 'unread_count'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if not msg:
            return None
        return {
            'id': msg.id,
            'content': msg.content,
            'created_at': msg.created_at,
            'sender_id': msg.sender_id,
        }

    def get_unread_count(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return 0
        return obj.messages.filter(recipient=user, is_read=False).count()


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.get_full_name', read_only=True)
    recipient_name = serializers.CharField(source='recipient.get_full_name', read_only=True)

    class Meta:
        model = ChatMessage
        fields = [
            'id', 'thread', 'sender', 'sender_name', 'recipient', 'recipient_name',
            'content', 'created_at', 'is_read', 'read_at'
        ]
        read_only_fields = ['created_at', 'is_read', 'read_at']


class ClassAnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = ClassAnnouncement
        fields = [
            'id', 'created_by', 'created_by_name', 'title', 'message',
            'target_class', 'target_section', 'created_at'
        ]
        read_only_fields = ['created_by', 'created_at']
