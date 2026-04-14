from rest_framework import serializers

from .models import LostFoundItem


class LostFoundItemSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.CharField(source='reported_by.get_full_name', read_only=True)
    reported_by_role = serializers.CharField(source='reported_by.role', read_only=True)
    found_by_name = serializers.CharField(source='found_by.get_full_name', read_only=True)

    class Meta:
        model = LostFoundItem
        fields = [
            'id',
            'item_type',
            'title',
            'description',
            'location',
            'status',
            'reported_by',
            'reported_by_name',
            'reported_by_role',
            'found_by',
            'found_by_name',
            'found_note',
            'created_at',
            'updated_at',
            'resolved_at',
        ]
        read_only_fields = ['reported_by', 'found_by', 'found_note', 'created_at', 'updated_at', 'resolved_at']
