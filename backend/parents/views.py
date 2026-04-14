from django.db.models import Count, Q
from django.db.models.functions import ExtractMonth
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from attendance.models import Attendance
from attendance.serializers import AttendanceSerializer
from events.models import CalendarEvent
from results.models import Result, Exam, ClassSubjectAssignment
from results.serializers import ResultSerializer
from tasks.models import Task

from .serializers import ParentProfileSerializer
from .utils import get_student_for_user


class ParentProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if getattr(request.user, 'role', None) != 'parent':
            return Response({'detail': 'Only parents can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            profile = request.user.parent_profile
        except Exception:
            return Response({'detail': 'Parent profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(ParentProfileSerializer(profile).data)


class ParentAttendanceListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = get_student_for_user(request.user)
        if not student or getattr(request.user, 'role', None) != 'parent':
            return Response({'detail': 'Only parents can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

        qs = Attendance.objects.filter(student=student).select_related('subject', 'teacher', 'student')
        serializer = AttendanceSerializer(qs, many=True)
        return Response(serializer.data)


class ParentAttendanceMonthlyProgressView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = get_student_for_user(request.user)
        if not student or getattr(request.user, 'role', None) != 'parent':
            return Response({'detail': 'Only parents can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

        year_param = request.query_params.get('year')
        month_param = request.query_params.get('month')
        try:
            year = int(year_param) if year_param else timezone.now().year
            month = int(month_param) if month_param else timezone.now().month
        except ValueError:
            return Response({'detail': 'Invalid year or month.'}, status=status.HTTP_400_BAD_REQUEST)

        if month < 1 or month > 12:
            return Response({'detail': 'Month must be between 1 and 12.'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Attendance.objects.filter(student=student, date__year=year, date__month=month)
        total_days = qs.count()
        present_days = qs.filter(status='present').count()
        late_days = qs.filter(status='late').count()
        absent_days = qs.filter(status='absent').count()
        excused_days = qs.filter(status='excused').count()
        progress = round(((present_days + late_days + excused_days) / total_days) * 100, 2) if total_days > 0 else 0

        return Response({
            'year': year,
            'month': month,
            'total_days': total_days,
            'present_days': present_days,
            'late_days': late_days,
            'absent_days': absent_days,
            'excused_days': excused_days,
            'progress': progress,
        }, status=status.HTTP_200_OK)


class ParentAttendanceYearlyProgressView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = get_student_for_user(request.user)
        if not student or getattr(request.user, 'role', None) != 'parent':
            return Response({'detail': 'Only parents can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

        year_param = request.query_params.get('year')
        try:
            year = int(year_param) if year_param else timezone.now().year
        except ValueError:
            return Response({'detail': 'Invalid year.'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Attendance.objects.filter(student=student, date__year=year)
        monthly = (
            qs.annotate(month=ExtractMonth('date'))
            .values('month')
            .annotate(
                total_days=Count('id'),
                present_days=Count('id', filter=Q(status__in=['present', 'late', 'excused']))
            )
        )

        month_stats = {item['month']: item for item in monthly}
        data = []
        for month in range(1, 13):
            item = month_stats.get(month, {'total_days': 0, 'present_days': 0})
            total_days = item.get('total_days', 0) or 0
            present_days = item.get('present_days', 0) or 0
            progress = round((present_days / total_days) * 100, 2) if total_days > 0 else 0
            data.append({
                'month': month,
                'total_days': total_days,
                'present_days': present_days,
                'progress': progress,
            })

        return Response({'year': year, 'data': data}, status=status.HTTP_200_OK)


class ParentResultsListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = get_student_for_user(request.user)
        if not student or getattr(request.user, 'role', None) != 'parent':
            return Response({'detail': 'Only parents can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

        qs = Result.objects.filter(student=student, status='approved').select_related('exam', 'exam__subject')
        serializer = ResultSerializer(qs, many=True)
        return Response(serializer.data)


class ParentCalendarView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student = get_student_for_user(request.user)
        if not student or getattr(request.user, 'role', None) != 'parent':
            return Response({'detail': 'Only parents can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

        # Academic calendar events
        events = CalendarEvent.objects.all()
        items = []
        for ev in events:
            items.append({
                'id': f"event-{ev.id}",
                'title': ev.title,
                'event_date': ev.event_date.isoformat(),
                'is_holiday': ev.is_holiday,
                'description': ev.description or '',
                'source': 'event',
            })

        # Exams filtered by class subjects
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

        # Tasks (assignments/projects)
        tasks_qs = Task.objects.filter(status='active').select_related('assigned_by')
        tasks_qs = tasks_qs.filter(
            Q(assigned_to_students=student) |
            Q(assigned_to_class=student.current_class, assigned_to_section__in=[None, '', student.current_section])
        ).distinct()

        for task in tasks_qs:
            due = task.due_date.date().isoformat() if task.due_date else None
            if not due:
                continue
            items.append({
                'id': f"task-{task.id}",
                'title': f"Task: {task.title}",
                'event_date': due,
                'is_holiday': False,
                'description': task.description[:140] if task.description else '',
                'source': 'task',
            })

        # Sort by date
        items.sort(key=lambda x: x.get('event_date') or '')
        return Response(items)
