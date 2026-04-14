from rest_framework import generics, permissions
from rest_framework.response import Response
from django.db.models import Q
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
from .serializers import (
    HostelSerializer,
    RoomSerializer,
    HostelAllocationSerializer,
    HostelFeeRecordSerializer,
    HostelMaintenanceRequestSerializer,
    HostelRoomRequestSerializer,
    HostelLeaveRequestSerializer,
    HostelAllocationPublicSerializer,
    HostelMessMenuSerializer,
)
from .permissions import IsHostelStaffOrReadOnly, IsHostelRequestActor, IsHostelMenuAccess
from .permissions import IsHostelMaintenanceAccess
from students.models import Student


class HostelListCreateView(generics.ListCreateAPIView):
    queryset = Hostel.objects.all()
    serializer_class = HostelSerializer
    permission_classes = [IsHostelStaffOrReadOnly]


class HostelDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Hostel.objects.all()
    serializer_class = HostelSerializer
    permission_classes = [IsHostelStaffOrReadOnly]


class RoomListCreateView(generics.ListCreateAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsHostelStaffOrReadOnly]


class RoomDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsHostelStaffOrReadOnly]


class HostelAllocationListCreateView(generics.ListCreateAPIView):
    queryset = HostelAllocation.objects.all()
    serializer_class = HostelAllocationSerializer
    permission_classes = [IsHostelStaffOrReadOnly]


class HostelAllocationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = HostelAllocation.objects.all()
    serializer_class = HostelAllocationSerializer
    permission_classes = [IsHostelStaffOrReadOnly]

    def perform_destroy(self, instance):
        if instance.is_active and instance.room:
            room = instance.room
            room.current_occupancy = max((room.current_occupancy or 0) - 1, 0)
            room.save(update_fields=['current_occupancy'])
            hostel = room.hostel
            if hostel:
                hostel.current_occupancy = max((hostel.current_occupancy or 0) - 1, 0)
                hostel.save(update_fields=['current_occupancy'])
        instance.delete()


class HostelFeeRecordListCreateView(generics.ListCreateAPIView):
    queryset = HostelFeeRecord.objects.all()
    serializer_class = HostelFeeRecordSerializer
    permission_classes = [IsHostelStaffOrReadOnly]

    def perform_create(self, serializer):
        user = getattr(self.request, 'user', None)
        serializer.save(recorded_by=user)


class HostelFeeRecordDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = HostelFeeRecord.objects.all()
    serializer_class = HostelFeeRecordSerializer
    permission_classes = [IsHostelStaffOrReadOnly]


class HostelMaintenanceRequestListCreateView(generics.ListCreateAPIView):
    queryset = HostelMaintenanceRequest.objects.all()
    serializer_class = HostelMaintenanceRequestSerializer
    permission_classes = [IsHostelMaintenanceAccess]

    def perform_create(self, serializer):
        user = getattr(self.request, 'user', None)
        if getattr(user, 'role', None) == 'hostel_warden':
            request_obj = serializer.save(reported_by=user, is_approved=True, approved_by=user, approved_on=timezone.now())
        else:
            request_obj = serializer.save(reported_by=user, is_approved=False)

        # Notify admins only after warden approval
        if request_obj.is_approved:
            try:
                from accounts.models import User
                from notices.utils import dispatch_alert

                room_label = getattr(request_obj.room, 'room_number', 'Unknown')
                hostel_name = getattr(getattr(request_obj.room, 'hostel', None), 'name', 'Hostel')
                title = 'Hostel Maintenance Request'
                content = f'Issue in {hostel_name} - Room {room_label}: {request_obj.issue}'
                for admin_user in User.objects.filter(role='admin'):
                    dispatch_alert(admin_user, title, content, link='/admin/hostel')
            except Exception:
                # Notification failures should not block the request creation
                pass

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        role = getattr(user, 'role', None)
        qs = HostelMaintenanceRequest.objects.select_related('room__hostel', 'reported_by', 'approved_by')
        if role == 'admin':
            return qs.filter(is_approved=True)
        if role == 'student':
            student = Student.objects.filter(user=user).first()
            if not student:
                return HostelMaintenanceRequest.objects.none()
            return qs.filter(Q(is_approved=True) | Q(reported_by=user)).distinct()
        return qs


class HostelMaintenanceRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = HostelMaintenanceRequest.objects.all()
    serializer_class = HostelMaintenanceRequestSerializer
    permission_classes = [IsHostelMaintenanceAccess]


class HostelRoomRequestListCreateView(generics.ListCreateAPIView):
    queryset = HostelRoomRequest.objects.select_related('student__user', 'room__hostel').all()
    serializer_class = HostelRoomRequestSerializer
    permission_classes = [IsHostelRequestActor]

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        role = getattr(user, 'role', None)
        if role == 'student':
            student = Student.objects.filter(user=user).first()
            if not student:
                return HostelRoomRequest.objects.none()
            return HostelRoomRequest.objects.filter(student=student).select_related('student__user', 'room__hostel')
        return HostelRoomRequest.objects.select_related('student__user', 'room__hostel').all()

    def perform_create(self, serializer):
        user = getattr(self.request, 'user', None)
        student = Student.objects.filter(user=user).first()
        if not student:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'Student profile not found.'})
        serializer.save(student=student, status='pending')


class HostelRoomRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = HostelRoomRequest.objects.select_related('student__user', 'room__hostel').all()
    serializer_class = HostelRoomRequestSerializer
    permission_classes = [IsHostelRequestActor]

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        role = getattr(user, 'role', None)
        if role == 'student':
            student = Student.objects.filter(user=user).first()
            if not student:
                return HostelRoomRequest.objects.none()
            return HostelRoomRequest.objects.filter(student=student).select_related('student__user', 'room__hostel')
        return HostelRoomRequest.objects.select_related('student__user', 'room__hostel').all()


class HostelLeaveRequestListCreateView(generics.ListCreateAPIView):
    queryset = HostelLeaveRequest.objects.select_related('student__user', 'warden_action_by', 'parent_action_by')
    serializer_class = HostelLeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        role = getattr(user, 'role', None)
        qs = HostelLeaveRequest.objects.select_related('student__user', 'warden_action_by', 'parent_action_by')

        if role == 'student':
            student = Student.objects.filter(user=user).first()
            if not student:
                return HostelLeaveRequest.objects.none()
            qs = qs.filter(student=student)
        elif role == 'parent':
            try:
                student = user.parent_profile.student
            except Exception:
                return HostelLeaveRequest.objects.none()
            qs = qs.filter(student=student)
        elif role in ['admin', 'hostel_warden']:
            pass
        else:
            return HostelLeaveRequest.objects.none()

        status_param = self.request.query_params.get('status')
        if status_param in ['pending_warden', 'pending_parent', 'approved', 'rejected']:
            qs = qs.filter(status=status_param)
        return qs

    def perform_create(self, serializer):
        user = getattr(self.request, 'user', None)
        if getattr(user, 'role', None) != 'student':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only students can request hostel leave.')

        student = Student.objects.filter(user=user).first()
        if not student:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'Student profile not found.'})

        if not HostelAllocation.objects.filter(student=student, is_active=True).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'Only hostel residents can request leave.'})

        leave = serializer.save(student=student, status='pending_warden')

        # Notify hostel wardens
        try:
            from accounts.models import User
            from notices.utils import dispatch_alert
            title = 'Hostel Leave Request'
            content = f"{student.user.get_full_name() or student.student_id} requested leave from {leave.start_date} to {leave.end_date}."
            for warden in User.objects.filter(role='hostel_warden'):
                dispatch_alert(warden, title, content, link='/hostel-warden')
        except Exception:
            pass


class HostelLeaveWardenApproveView(generics.GenericAPIView):
    queryset = HostelLeaveRequest.objects.select_related('student__user', 'warden_action_by', 'parent_action_by')
    serializer_class = HostelLeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'hostel_warden':
            return Response({'detail': 'Only hostel wardens can approve leave.'}, status=403)

        leave = self.get_object()
        if leave.status != 'pending_warden':
            return Response({'detail': 'Only pending warden requests can be approved.'}, status=400)

        note = request.data.get('note', '') or ''
        leave.status = 'pending_parent'
        leave.warden_note = note
        leave.warden_action_by = request.user
        leave.warden_action_on = timezone.now()
        leave.save()

        # Notify parent + student
        try:
            from notices.utils import dispatch_alert
            parent_user = None
            try:
                parent_user = leave.student.parent_profiles.first().user
            except Exception:
                parent_user = None

            title = 'Hostel Leave Awaiting Parent Consent'
            content = f"Warden approved leave for {leave.student.student_id}. Please approve from {leave.start_date} to {leave.end_date}."
            if parent_user:
                dispatch_alert(parent_user, title, content, link='/parent/hostel-leave')
            dispatch_alert(leave.student.user, 'Hostel Leave Update', 'Warden approved your leave. Waiting for parent approval.', link='/student/hostel')
        except Exception:
            pass

        return Response(HostelLeaveRequestSerializer(leave, context={'request': request}).data, status=200)


class HostelLeaveWardenRejectView(generics.GenericAPIView):
    queryset = HostelLeaveRequest.objects.select_related('student__user', 'warden_action_by', 'parent_action_by')
    serializer_class = HostelLeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'hostel_warden':
            return Response({'detail': 'Only hostel wardens can reject leave.'}, status=403)

        leave = self.get_object()
        if leave.status != 'pending_warden':
            return Response({'detail': 'Only pending warden requests can be rejected.'}, status=400)

        note = request.data.get('note', '') or ''
        leave.status = 'rejected'
        leave.warden_note = note
        leave.warden_action_by = request.user
        leave.warden_action_on = timezone.now()
        leave.save()

        # Notify student + parent
        try:
            from notices.utils import dispatch_alert
            parent_user = None
            try:
                parent_user = leave.student.parent_profiles.first().user
            except Exception:
                parent_user = None
            content = f"Warden rejected leave request from {leave.start_date} to {leave.end_date}."
            if note:
                content += f" Note: {note}"
            if parent_user:
                dispatch_alert(parent_user, 'Hostel Leave Rejected', content, link='/parent/hostel-leave')
            dispatch_alert(leave.student.user, 'Hostel Leave Rejected', content, link='/student/hostel')
        except Exception:
            pass

        return Response(HostelLeaveRequestSerializer(leave, context={'request': request}).data, status=200)


class HostelLeaveParentApproveView(generics.GenericAPIView):
    queryset = HostelLeaveRequest.objects.select_related('student__user', 'warden_action_by', 'parent_action_by')
    serializer_class = HostelLeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'parent':
            return Response({'detail': 'Only parents can approve leave.'}, status=403)

        leave = self.get_object()
        try:
            parent_student = request.user.parent_profile.student
        except Exception:
            return Response({'detail': 'Parent profile not found.'}, status=404)

        if leave.student_id != parent_student.id:
            return Response({'detail': 'You can only approve your own child requests.'}, status=403)

        if leave.status != 'pending_parent':
            return Response({'detail': 'Only pending parent requests can be approved.'}, status=400)

        note = request.data.get('note', '') or ''
        leave.status = 'approved'
        leave.parent_note = note
        leave.parent_action_by = request.user
        leave.parent_action_on = timezone.now()
        leave.save()

        # Notify student + warden
        try:
            from notices.utils import dispatch_alert
            content = f"Parent approved leave from {leave.start_date} to {leave.end_date}."
            if note:
                content += f" Note: {note}"
            dispatch_alert(leave.student.user, 'Hostel Leave Approved', content, link='/student/hostel')
            from accounts.models import User
            for warden in User.objects.filter(role='hostel_warden'):
                dispatch_alert(warden, 'Hostel Leave Approved', content, link='/hostel-warden')
        except Exception:
            pass

        return Response(HostelLeaveRequestSerializer(leave, context={'request': request}).data, status=200)


class HostelLeaveParentRejectView(generics.GenericAPIView):
    queryset = HostelLeaveRequest.objects.select_related('student__user', 'warden_action_by', 'parent_action_by')
    serializer_class = HostelLeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'parent':
            return Response({'detail': 'Only parents can reject leave.'}, status=403)

        leave = self.get_object()
        try:
            parent_student = request.user.parent_profile.student
        except Exception:
            return Response({'detail': 'Parent profile not found.'}, status=404)

        if leave.student_id != parent_student.id:
            return Response({'detail': 'You can only reject your own child requests.'}, status=403)

        if leave.status != 'pending_parent':
            return Response({'detail': 'Only pending parent requests can be rejected.'}, status=400)

        note = request.data.get('note', '') or ''
        leave.status = 'rejected'
        leave.parent_note = note
        leave.parent_action_by = request.user
        leave.parent_action_on = timezone.now()
        leave.save()

        # Notify student + warden
        try:
            from notices.utils import dispatch_alert
            content = f"Parent rejected leave from {leave.start_date} to {leave.end_date}."
            if note:
                content += f" Note: {note}"
            dispatch_alert(leave.student.user, 'Hostel Leave Rejected', content, link='/student/hostel')
            from accounts.models import User
            for warden in User.objects.filter(role='hostel_warden'):
                dispatch_alert(warden, 'Hostel Leave Rejected', content, link='/hostel-warden')
        except Exception:
            pass

        return Response(HostelLeaveRequestSerializer(leave, context={'request': request}).data, status=200)


class HostelPublicListView(generics.ListAPIView):
    queryset = Hostel.objects.filter(is_active=True)
    serializer_class = HostelSerializer
    permission_classes = [permissions.IsAuthenticated]


class HostelRoomPublicListView(generics.ListAPIView):
    queryset = Room.objects.filter(is_active=True)
    serializer_class = RoomSerializer
    permission_classes = [permissions.IsAuthenticated]


class HostelAllocationPublicListView(generics.ListAPIView):
    queryset = HostelAllocation.objects.filter(is_active=True).select_related('student__user', 'room__hostel')
    serializer_class = HostelAllocationPublicSerializer
    permission_classes = [permissions.IsAuthenticated]


class HostelMessMenuListCreateView(generics.ListCreateAPIView):
    queryset = HostelMessMenu.objects.all()
    serializer_class = HostelMessMenuSerializer
    permission_classes = [IsHostelMenuAccess]

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        role = getattr(user, 'role', None)
        if role == 'student':
            student = Student.objects.filter(user=user).first()
            if not student:
                return HostelMessMenu.objects.none()
            if not HostelAllocation.objects.filter(student=student, is_active=True).exists():
                return HostelMessMenu.objects.none()
        return HostelMessMenu.objects.all()

    def perform_create(self, serializer):
        user = getattr(self.request, 'user', None)
        serializer.save(created_by=user)


class HostelMessMenuDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = HostelMessMenu.objects.all()
    serializer_class = HostelMessMenuSerializer
    permission_classes = [IsHostelMenuAccess]

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        role = getattr(user, 'role', None)
        if role == 'student':
            student = Student.objects.filter(user=user).first()
            if not student:
                return HostelMessMenu.objects.none()
            if not HostelAllocation.objects.filter(student=student, is_active=True).exists():
                return HostelMessMenu.objects.none()
        return HostelMessMenu.objects.all()
