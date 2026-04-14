from datetime import date

from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Q
from django.utils import timezone

from .models import CalendarEvent, EventPhoto
from .serializers import CalendarEventSerializer, EventPhotoSerializer
from parents.utils import get_student_for_user
from results.models import Exam, ClassSubjectAssignment
from tasks.models import Task


class CalendarEventListCreateView(generics.ListCreateAPIView):
    serializer_class = CalendarEventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = CalendarEvent.objects.select_related('created_by').all()
        start = self.request.query_params.get('start')
        end = self.request.query_params.get('end')

        if start:
            try:
                start_date = date.fromisoformat(start)
            except ValueError:
                raise ValidationError({'start': 'Invalid start date format. Use YYYY-MM-DD.'})
            qs = qs.filter(event_date__gte=start_date)

        if end:
            try:
                end_date = date.fromisoformat(end)
            except ValueError:
                raise ValidationError({'end': 'Invalid end date format. Use YYYY-MM-DD.'})
            qs = qs.filter(event_date__lte=end_date)

        return qs

    def perform_create(self, serializer):
        if self.request.user.role not in ['admin', 'teacher']:
            raise PermissionDenied('Only admins and teachers can create events.')
        serializer.save(created_by=self.request.user)


class EventPhotoListCreateView(generics.ListCreateAPIView):
    serializer_class = EventPhotoSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get_queryset(self):
        user = self.request.user
        qs = EventPhoto.objects.select_related('event', 'uploaded_by', 'approved_by').all()

        status = self.request.query_params.get('status')
        event_id = self.request.query_params.get('event')

        if user.role == 'admin':
            filtered = qs
        else:
            filtered = qs.filter(Q(approval_status='approved') | Q(uploaded_by=user))

        if status in ['pending', 'approved', 'rejected']:
            filtered = filtered.filter(approval_status=status)

        if event_id:
            try:
                filtered = filtered.filter(event_id=int(event_id))
            except ValueError:
                raise ValidationError({'event': 'Invalid event id.'})

        return filtered

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ['admin', 'teacher', 'student']:
            raise PermissionDenied('Only admin, teacher, or student can upload photos.')
        if user.role == 'admin':
            serializer.save(
                uploaded_by=user,
                approval_status='approved',
                approved_by=user,
                approved_at=timezone.now(),
            )
        else:
            serializer.save(uploaded_by=user, approval_status='pending')


class EventPhotoApprovedListView(generics.ListAPIView):
    serializer_class = EventPhotoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return EventPhoto.objects.select_related('event', 'uploaded_by', 'approved_by').filter(approval_status='approved')


class EventPhotoDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EventPhotoSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)
    queryset = EventPhoto.objects.select_related('event', 'uploaded_by', 'approved_by')

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        if request.user.role != 'admin' and obj.uploaded_by != request.user:
            raise PermissionDenied('You do not have permission to edit this photo.')
        if obj.approval_status == 'approved' and request.user.role != 'admin':
            raise PermissionDenied('Approved photos cannot be edited.')
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if request.user.role == 'admin':
            return super().destroy(request, *args, **kwargs)
        if obj.uploaded_by != request.user:
            raise PermissionDenied('You do not have permission to delete this photo.')
        if obj.approval_status == 'approved':
            raise PermissionDenied('Approved photos cannot be deleted.')
        return super().destroy(request, *args, **kwargs)


class EventPhotoApprovalView(generics.UpdateAPIView):
    serializer_class = EventPhotoSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = EventPhoto.objects.select_related('event', 'uploaded_by', 'approved_by')

    def patch(self, request, pk):
        if request.user.role != 'admin':
            raise PermissionDenied('Only admin can approve photos.')
        try:
            photo = EventPhoto.objects.get(pk=pk)
        except EventPhoto.DoesNotExist:
            return Response({'detail': 'Photo not found'}, status=status.HTTP_404_NOT_FOUND)

        action = (request.data.get('action') or request.data.get('status') or '').lower()
        reason = (request.data.get('rejection_reason') or '').strip()

        if action in ['approve', 'approved']:
            photo.approval_status = 'approved'
            photo.approved_by = request.user
            photo.approved_at = timezone.now()
            photo.rejection_reason = ''
        elif action in ['reject', 'rejected']:
            photo.approval_status = 'rejected'
            photo.approved_by = None
            photo.approved_at = None
            photo.rejection_reason = reason
        else:
            raise ValidationError({'detail': 'Invalid action. Use approve or reject.'})

        photo.save()
        serializer = EventPhotoSerializer(photo, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class AcademicCalendarView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        user = request.user
        items = []

        # Always include base calendar events
        for ev in CalendarEvent.objects.all():
            items.append({
                'id': f"event-{ev.id}",
                'title': ev.title,
                'event_date': ev.event_date.isoformat(),
                'is_holiday': ev.is_holiday,
                'description': ev.description or '',
                'source': 'event',
            })

        if getattr(user, 'role', None) in ['student', 'parent']:
            student = get_student_for_user(user)
            if not student:
                return Response({'detail': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

            subject_ids = list(
                ClassSubjectAssignment.objects.filter(
                    class_name=student.current_class,
                    section=student.current_section,
                    is_active=True,
                ).values_list('subject_id', flat=True)
            )

            exams = Exam.objects.filter(
                subject_id__in=subject_ids,
                class_name__iexact=student.current_class,
            ).select_related('subject')
            if student.current_section:
                exams = exams.filter(Q(section__iexact=student.current_section) | Q(section__isnull=True) | Q(section=''))
            else:
                exams = exams.filter(Q(section__isnull=True) | Q(section=''))

            for exam in exams:
                time_label = ''
                if exam.start_time or exam.end_time:
                    start = exam.start_time.strftime('%H:%M') if exam.start_time else '--:--'
                    end = exam.end_time.strftime('%H:%M') if exam.end_time else '--:--'
                    time_label = f"Time: {start} - {end}"
                items.append({
                    'id': f"exam-{exam.id}",
                    'title': f"Exam: {exam.name}",
                    'event_date': exam.exam_date.isoformat(),
                    'is_holiday': False,
                    'description': " | ".join([s for s in [exam.subject.name if exam.subject else '', time_label] if s]),
                    'source': 'exam',
                })

            tasks_qs = Task.objects.filter(status='active').filter(
                Q(assigned_to_students=student) |
                Q(assigned_to_class=student.current_class, assigned_to_section__in=[None, '', student.current_section])
            ).distinct()

            for task in tasks_qs:
                if not task.due_date:
                    continue
                items.append({
                    'id': f"task-{task.id}",
                    'title': f"Task: {task.title}",
                    'event_date': task.due_date.date().isoformat(),
                    'is_holiday': False,
                    'description': task.description[:140] if task.description else '',
                    'source': 'task',
                })

        items.sort(key=lambda x: x.get('event_date') or '')
        return Response(items)
