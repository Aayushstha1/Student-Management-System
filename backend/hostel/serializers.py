from rest_framework import serializers
from django.utils import timezone
from .models import (
    Hostel,
    Room,
    HostelAllocation,
    HostelFeeRecord,
    HostelMaintenanceRequest,
    HostelRoomRequest,
    HostelLeaveRequest,
    HostelMessMenu,
)
from students.models import Student


class HostelSerializer(serializers.ModelSerializer):
    available_beds = serializers.IntegerField(read_only=True)
    class Meta:
        model = Hostel
        fields = '__all__'


class RoomSerializer(serializers.ModelSerializer):
    hostel_name = serializers.CharField(source='hostel.name', read_only=True)
    available_beds = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Room
        fields = '__all__'


class HostelAllocationSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_class = serializers.CharField(source='student.current_class', read_only=True)
    student_section = serializers.CharField(source='student.current_section', read_only=True)
    room_info = serializers.CharField(source='room', read_only=True)
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    room_type = serializers.CharField(source='room.room_type', read_only=True)
    hostel_id = serializers.IntegerField(source='room.hostel.id', read_only=True)
    hostel_name = serializers.CharField(source='room.hostel.name', read_only=True)
    room_available_beds = serializers.IntegerField(source='room.available_beds', read_only=True)
    
    class Meta:
        model = HostelAllocation
        fields = '__all__'

    def _update_occupancy(self, room, delta):
        if not room:
            return
        room.current_occupancy = max((room.current_occupancy or 0) + delta, 0)
        room.save(update_fields=['current_occupancy'])
        hostel = room.hostel
        if hostel:
            hostel.current_occupancy = max((hostel.current_occupancy or 0) + delta, 0)
            hostel.save(update_fields=['current_occupancy'])

    def validate(self, attrs):
        room = attrs.get('room') or (self.instance.room if self.instance else None)
        is_active = attrs.get('is_active')
        if is_active is None and self.instance is not None:
            is_active = self.instance.is_active
        if is_active is None:
            is_active = True

        if room and attrs.get('monthly_rent') in [None, '']:
            attrs['monthly_rent'] = room.monthly_rent

        if room and is_active:
            available = room.available_beds
            if self.instance and self.instance.is_active and self.instance.room_id == room.id:
                available += 1
            if available <= 0:
                raise serializers.ValidationError({'room': 'No available beds in this room.'})
        return attrs

    def create(self, validated_data):
        allocation = super().create(validated_data)
        if allocation.is_active:
            self._update_occupancy(allocation.room, 1)
        return allocation

    def update(self, instance, validated_data):
        prev_room = instance.room
        prev_active = instance.is_active
        new_room = validated_data.get('room', prev_room)
        new_active = validated_data.get('is_active', prev_active)

        allocation = super().update(instance, validated_data)

        prev_room_id = prev_room.id if prev_room else None
        new_room_id = new_room.id if new_room else None

        if prev_active and (not new_active or prev_room_id != new_room_id):
            self._update_occupancy(prev_room, -1)
        if new_active and (not prev_active or prev_room_id != new_room_id):
            self._update_occupancy(new_room, 1)

        return allocation


class HostelFeeRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    hostel_name = serializers.CharField(source='room.hostel.name', read_only=True)

    class Meta:
        model = HostelFeeRecord
        fields = '__all__'


class HostelMaintenanceRequestSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    hostel_name = serializers.CharField(source='room.hostel.name', read_only=True)
    reported_by_name = serializers.SerializerMethodField()
    reported_by_role = serializers.CharField(source='reported_by.role', read_only=True)
    reported_by_student_id = serializers.SerializerMethodField()
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True)

    class Meta:
        model = HostelMaintenanceRequest
        fields = '__all__'
        read_only_fields = ['reported_by', 'reported_on', 'approved_by', 'approved_on']

    def get_reported_by_student_id(self, obj):
        try:
            if obj.reported_by and getattr(obj.reported_by, 'role', None) == 'student':
                student = Student.objects.filter(user=obj.reported_by).first()
                if student:
                    return student.student_id
        except Exception:
            return None
        return None

    def get_reported_by_name(self, obj):
        try:
            user = obj.reported_by
            if not user:
                return None
            name = user.get_full_name()
            return name if name else user.username
        except Exception:
            return None

    def validate(self, attrs):
        request = self.context.get('request')
        if request and request.method == 'POST':
            user = getattr(request, 'user', None)
            if user and getattr(user, 'role', None) == 'student':
                student = Student.objects.filter(user=user).first()
                if not student:
                    raise serializers.ValidationError({'detail': 'Student profile not found.'})
                if not HostelAllocation.objects.filter(student=student, is_active=True).exists():
                    raise serializers.ValidationError({'detail': 'Only hostel residents can report maintenance.'})
        return attrs

    def update(self, instance, validated_data):
        request = self.context.get('request')
        new_approved = validated_data.get('is_approved', instance.is_approved)
        if new_approved != instance.is_approved:
            if not request or getattr(request.user, 'role', None) != 'hostel_warden':
                raise serializers.ValidationError({'detail': 'Only hostel wardens can approve maintenance.'})
            if new_approved:
                validated_data['approved_by'] = request.user
                validated_data['approved_on'] = timezone.now()
                try:
                    from accounts.models import User
                    from notices.utils import dispatch_alert
                    room_label = getattr(instance.room, 'room_number', 'Unknown')
                    hostel_name = getattr(getattr(instance.room, 'hostel', None), 'name', 'Hostel')
                    title = 'Hostel Maintenance Approved'
                    content = f'Issue in {hostel_name} - Room {room_label}: {instance.issue}'
                    for admin_user in User.objects.filter(role='admin'):
                        dispatch_alert(admin_user, title, content, link='/admin/hostel')
                except Exception:
                    pass
        return super().update(instance, validated_data)


class HostelRoomRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_class = serializers.CharField(source='student.current_class', read_only=True)
    student_section = serializers.CharField(source='student.current_section', read_only=True)
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    hostel_name = serializers.CharField(source='room.hostel.name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True)

    class Meta:
        model = HostelRoomRequest
        fields = '__all__'
        read_only_fields = ['student', 'requested_on', 'reviewed_by', 'reviewed_on']

    def validate(self, attrs):
        request = self.context.get('request')
        if request and request.method == 'POST':
            user = getattr(request, 'user', None)
            student = Student.objects.filter(user=user).first() if user else None
            if not student:
                raise serializers.ValidationError({'detail': 'Student profile not found.'})
            if HostelAllocation.objects.filter(student=student, is_active=True).exists():
                raise serializers.ValidationError({'detail': 'Student already has an active hostel allocation.'})
            if HostelRoomRequest.objects.filter(student=student, status='pending').exists():
                raise serializers.ValidationError({'detail': 'A pending request already exists.'})
            room = attrs.get('room')
            if room and room.available_beds <= 0:
                raise serializers.ValidationError({'room': 'No available beds in this room.'})
        return attrs

    def update(self, instance, validated_data):
        try:
            request = self.context.get('request')
            new_status = validated_data.get('status', instance.status)
            if new_status != instance.status:
                if instance.status != 'pending':
                    raise serializers.ValidationError({'status': 'Only pending requests can be updated.'})
                if not request or getattr(request.user, 'role', None) != 'hostel_warden':
                    raise serializers.ValidationError({'detail': 'Only hostel wardens can update request status.'})

                if new_status == 'approved':
                    if HostelAllocation.objects.filter(student=instance.student, is_active=True).exists():
                        raise serializers.ValidationError({'detail': 'Student already has an active allocation.'})
                    room = instance.room
                    if not room:
                        raise serializers.ValidationError({'room': 'Room not found.'})
                    if room.available_beds <= 0:
                        raise serializers.ValidationError({'room': 'No available beds in this room.'})
                    existing = HostelAllocation.objects.filter(student=instance.student).first()
                    if existing:
                        # Reuse inactive allocation record
                        if existing.is_active:
                            raise serializers.ValidationError({'detail': 'Student already has an active allocation.'})
                        existing.room = room
                        existing.allocated_date = timezone.now().date()
                        existing.monthly_rent = room.monthly_rent
                        existing.is_active = True
                        existing.save()
                    else:
                        HostelAllocation.objects.create(
                            student=instance.student,
                            room=room,
                            allocated_date=timezone.now().date(),
                            monthly_rent=room.monthly_rent,
                            is_active=True,
                        )
                    # Update occupancy counts
                    room.current_occupancy = max((room.current_occupancy or 0) + 1, 0)
                    room.save(update_fields=['current_occupancy'])
                    hostel = room.hostel
                    if hostel:
                        hostel.current_occupancy = max((hostel.current_occupancy or 0) + 1, 0)
                        hostel.save(update_fields=['current_occupancy'])

                validated_data['reviewed_by'] = request.user
                validated_data['reviewed_on'] = timezone.now()

            return super().update(instance, validated_data)
        except serializers.ValidationError:
            raise
        except Exception:
            raise serializers.ValidationError({'detail': 'Failed to update request. Check room and allocation setup.'})


class HostelLeaveRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_class = serializers.CharField(source='student.current_class', read_only=True)
    student_section = serializers.CharField(source='student.current_section', read_only=True)
    room_number = serializers.SerializerMethodField()
    hostel_name = serializers.SerializerMethodField()
    warden_action_by_name = serializers.CharField(source='warden_action_by.username', read_only=True)
    parent_action_by_name = serializers.CharField(source='parent_action_by.username', read_only=True)

    class Meta:
        model = HostelLeaveRequest
        fields = '__all__'
        read_only_fields = [
            'student',
            'status',
            'warden_action_by',
            'warden_action_on',
            'parent_action_by',
            'parent_action_on',
            'created_at',
            'updated_at',
        ]

    def get_room_number(self, obj):
        try:
            allocation = HostelAllocation.objects.filter(student=obj.student, is_active=True).select_related('room').first()
            return allocation.room.room_number if allocation and allocation.room else None
        except Exception:
            return None

    def get_hostel_name(self, obj):
        try:
            allocation = HostelAllocation.objects.filter(student=obj.student, is_active=True).select_related('room__hostel').first()
            if allocation and allocation.room and allocation.room.hostel:
                return allocation.room.hostel.name
        except Exception:
            return None
        return None

    def validate(self, attrs):
        start = attrs.get('start_date') or (self.instance.start_date if self.instance else None)
        end = attrs.get('end_date') or (self.instance.end_date if self.instance else None)
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'End date must be on or after start date.'})
        return attrs


class HostelAllocationPublicSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_class = serializers.CharField(source='student.current_class', read_only=True)
    student_section = serializers.CharField(source='student.current_section', read_only=True)
    room_id = serializers.IntegerField(source='room.id', read_only=True)
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    hostel_name = serializers.CharField(source='room.hostel.name', read_only=True)
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = HostelAllocation
        fields = [
            'id',
            'room_id',
            'room_number',
            'hostel_name',
            'student_name',
            'student_id',
            'student_class',
            'student_section',
            'profile_picture_url',
        ]

    def get_profile_picture_url(self, obj):
        try:
            if obj.student and obj.student.user and obj.student.user.profile_picture:
                url = obj.student.user.profile_picture.url
                request = self.context.get('request') if hasattr(self, 'context') else None
                if request:
                    return request.build_absolute_uri(url)
                return url
        except Exception:
            return None
        return None


class HostelMessMenuSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = HostelMessMenu
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at']
