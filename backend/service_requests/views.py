from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from parents.utils import get_student_for_user
from .models import ServiceRequest
from .serializers import (
    ServiceRequestSerializer,
    ServiceRequestCreateSerializer,
    ServiceRequestRespondSerializer,
)


class ServiceRequestListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ServiceRequestCreateSerializer
        return ServiceRequestSerializer

    def get_queryset(self):
        qs = ServiceRequest.objects.select_related('student__user', 'handled_by').all()
        user = self.request.user
        role = getattr(user, 'role', None)

        status_param = self.request.query_params.get('status')
        type_param = self.request.query_params.get('request_type')
        if status_param:
            qs = qs.filter(status=status_param)
        if type_param:
            qs = qs.filter(request_type=type_param)

        if role == 'student':
            student = get_student_for_user(user)
            if not student:
                return ServiceRequest.objects.none()
            return qs.filter(student=student)

        if role in ['librarian', 'hostel_warden']:
            return qs.filter(assigned_role=role)

        if role == 'admin':
            return qs

        return ServiceRequest.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if getattr(user, 'role', None) != 'student':
            raise PermissionDenied('Only students can submit requests.')
        student = get_student_for_user(user)
        serializer.save(student=student)


class ServiceRequestDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = ServiceRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ServiceRequest.objects.select_related('student__user', 'handled_by')

    def perform_destroy(self, instance):
        user = self.request.user
        if getattr(user, 'role', None) == 'student':
            if instance.student.user != user:
                raise PermissionDenied('Permission denied.')
            if instance.status != 'pending':
                raise PermissionDenied('Only pending requests can be cancelled.')
            instance.delete()
            return
        if getattr(user, 'role', None) == 'admin':
            instance.delete()
            return
        raise PermissionDenied('Permission denied.')


class ServiceRequestRespondView(generics.GenericAPIView):
    serializer_class = ServiceRequestRespondSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            req = ServiceRequest.objects.select_related('student__user').get(pk=pk)
        except ServiceRequest.DoesNotExist:
            return Response({'detail': 'Request not found.'}, status=status.HTTP_404_NOT_FOUND)

        role = getattr(request.user, 'role', None)
        if role not in ['admin', 'librarian', 'hostel_warden']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        if role != 'admin' and req.assigned_role != role:
            return Response({'detail': 'You can only respond to your assigned requests.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        status_value = serializer.validated_data['status']
        response_note = serializer.validated_data.get('response_note', '') or ''

        req.status = status_value
        req.response_note = response_note
        req.handled_by = request.user
        req.handled_at = timezone.now()
        req.save(update_fields=['status', 'response_note', 'handled_by', 'handled_at', 'updated_at'])

        # Notify the student
        try:
            from notices.models import UserNotification
            if req.student and req.student.user:
                title = 'Request Update'
                content = f"Your {req.get_request_type_display()} request is now {req.get_status_display()}."
                if response_note:
                    content += f" Note: {response_note}"
                UserNotification.objects.create(
                    user=req.student.user,
                    title=title,
                    content=content,
                    link='/student/requests'
                )
        except Exception:
            pass

        return Response(ServiceRequestSerializer(req).data, status=status.HTTP_200_OK)
