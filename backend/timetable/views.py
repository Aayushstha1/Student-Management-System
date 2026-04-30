from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from parents.utils import get_student_for_user
from .conflicts import collect_schedule_conflicts
from .models import ClassSchedule, LessonPlan
from .serializers import ClassScheduleSerializer, LessonPlanSerializer


class ClassScheduleListCreateView(generics.ListCreateAPIView):
    serializer_class = ClassScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = ClassSchedule.objects.select_related('subject', 'teacher', 'teacher__user').all()
        user = self.request.user
        class_name = self.request.query_params.get('class_name')
        section = self.request.query_params.get('section')

        if getattr(user, 'role', None) in ['student', 'parent']:
            student = get_student_for_user(user)
            if not student:
                return ClassSchedule.objects.none()
            return qs.filter(class_name=student.current_class, section=student.current_section, is_active=True)

        if getattr(user, 'role', None) == 'teacher' and hasattr(user, 'teacher_profile'):
            qs = qs.filter(teacher=user.teacher_profile)

        if class_name:
            qs = qs.filter(class_name=class_name)
        if section is not None:
            qs = qs.filter(section=section)
        return qs

    def perform_create(self, serializer):
        if getattr(self.request.user, 'role', None) != 'admin':
            raise PermissionDenied('Only admin can create schedules.')
        serializer.save()


class ClassScheduleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ClassScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ClassSchedule.objects.select_related('subject', 'teacher', 'teacher__user')

    def update(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'admin':
            return Response({'detail': 'Only admin can update schedules.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'admin':
            return Response({'detail': 'Only admin can delete schedules.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class ClassScheduleConflictView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) not in ['admin', 'teacher']:
            return Response({'detail': 'Only admin or teacher can view timetable conflicts.'}, status=status.HTTP_403_FORBIDDEN)

        conflicts = collect_schedule_conflicts()
        class_name = (request.query_params.get('class_name') or '').strip().lower()
        section = (request.query_params.get('section') or '').strip().lower()

        if class_name or section:
            filtered = []
            for conflict in conflicts:
                entries = conflict.get('entries') or []
                if any(
                    (not class_name or str(entry.get('class_name') or '').strip().lower() == class_name)
                    and (not section or str(entry.get('section') or '').strip().lower() == section)
                    for entry in entries
                ):
                    filtered.append(conflict)
            conflicts = filtered

        return Response({'count': len(conflicts), 'results': conflicts}, status=status.HTTP_200_OK)


class LessonPlanListCreateView(generics.ListCreateAPIView):
    serializer_class = LessonPlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = LessonPlan.objects.select_related(
            'schedule', 'schedule__subject', 'schedule__teacher', 'schedule__teacher__user'
        )
        user = self.request.user
        class_name = self.request.query_params.get('class_name')
        section = self.request.query_params.get('section')
        schedule_id = self.request.query_params.get('schedule')
        lesson_date = self.request.query_params.get('lesson_date')
        teacher_id = self.request.query_params.get('teacher')

        if getattr(user, 'role', None) in ['student', 'parent']:
            student = get_student_for_user(user)
            if not student:
                return LessonPlan.objects.none()
            return qs.filter(
                schedule__class_name=student.current_class,
                schedule__section=student.current_section,
            )

        if getattr(user, 'role', None) == 'teacher' and hasattr(user, 'teacher_profile'):
            qs = qs.filter(schedule__teacher=user.teacher_profile)

        if class_name:
            qs = qs.filter(schedule__class_name=class_name)
        if section is not None:
            qs = qs.filter(schedule__section=section)
        if schedule_id:
            qs = qs.filter(schedule_id=schedule_id)
        if lesson_date:
            qs = qs.filter(lesson_date=lesson_date)
        if teacher_id:
            qs = qs.filter(schedule__teacher_id=teacher_id)
        return qs

    def perform_create(self, serializer):
        if getattr(self.request.user, 'role', None) not in ['admin', 'teacher']:
            raise PermissionDenied('Only admin or teacher can create lesson plans.')
        if getattr(self.request.user, 'role', None) == 'teacher':
            schedule = serializer.validated_data.get('schedule')
            teacher_profile = getattr(self.request.user, 'teacher_profile', None)
            if schedule and teacher_profile and schedule.teacher_id != teacher_profile.id:
                raise PermissionDenied('You can only create lesson plans for your own schedules.')
        serializer.save(created_by=self.request.user)


class LessonPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = LessonPlanSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = LessonPlan.objects.select_related('schedule', 'schedule__subject', 'schedule__teacher', 'schedule__teacher__user')

    def update(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) not in ['admin', 'teacher']:
            return Response({'detail': 'Only admin or teacher can update lesson plans.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) not in ['admin', 'teacher']:
            return Response({'detail': 'Only admin or teacher can delete lesson plans.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)
