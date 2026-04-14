from rest_framework import serializers

from .models import CalendarEvent, EventPhoto


class CalendarEventSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    created_by_role = serializers.SerializerMethodField()

    class Meta:
        model = CalendarEvent
        fields = [
            'id',
            'title',
            'event_date',
            'is_holiday',
            'description',
            'created_by',
            'created_by_name',
            'created_by_role',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'created_by',
            'created_by_name',
            'created_by_role',
            'created_at',
        ]

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ''
        full_name = f"{obj.created_by.first_name or ''} {obj.created_by.last_name or ''}".strip()
        return full_name or obj.created_by.username

    def get_created_by_role(self, obj):
        return getattr(obj.created_by, 'role', '')


class EventPhotoSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    uploaded_by_role = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    event_title = serializers.SerializerMethodField()
    event_date = serializers.SerializerMethodField()

    class Meta:
        model = EventPhoto
        fields = [
            'id',
            'event',
            'event_title',
            'event_date',
            'title',
            'description',
            'image',
            'image_url',
            'uploaded_by',
            'uploaded_by_name',
            'uploaded_by_role',
            'approval_status',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'rejection_reason',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'uploaded_by',
            'uploaded_by_name',
            'uploaded_by_role',
            'approval_status',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'rejection_reason',
            'created_at',
        ]

    def get_image_url(self, obj):
        try:
            if obj.image:
                request = self.context.get('request') if hasattr(self, 'context') else None
                url = obj.image.url
                if request:
                    return request.build_absolute_uri(url)
                return url
            return None
        except Exception:
            return None

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by:
            return ''
        full_name = f"{obj.uploaded_by.first_name or ''} {obj.uploaded_by.last_name or ''}".strip()
        return full_name or obj.uploaded_by.username

    def get_uploaded_by_role(self, obj):
        return getattr(obj.uploaded_by, 'role', '')

    def get_approved_by_name(self, obj):
        if not obj.approved_by:
            return ''
        full_name = f"{obj.approved_by.first_name or ''} {obj.approved_by.last_name or ''}".strip()
        return full_name or obj.approved_by.username

    def get_event_title(self, obj):
        return obj.event.title if obj.event else ''

    def get_event_date(self, obj):
        return obj.event.event_date if obj.event else None
