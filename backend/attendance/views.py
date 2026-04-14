from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils.dateparse import parse_date
from django.utils import timezone
from django.db.models import Count, Q
from django.db.models.functions import ExtractMonth
from django.shortcuts import get_object_or_404
from django.db import transaction
from calendar import monthrange
from datetime import date as date_cls
from .models import Subject, Attendance, AttendanceReport, AttendanceSession, LeaveRequest
from students.models import Student
from .serializers import (
    SubjectSerializer,
    AttendanceSerializer,
    AttendanceReportSerializer,
    AttendanceSessionSerializer,
    LeaveRequestSerializer,
    LeaveRequestCreateSerializer,
)


class SubjectListCreateView(generics.ListCreateAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]


class SubjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]


class AttendanceListCreateView(generics.ListCreateAPIView):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]


class AttendanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]


class AttendanceReportListCreateView(generics.ListCreateAPIView):
    queryset = AttendanceReport.objects.all()
    serializer_class = AttendanceReportSerializer
    permission_classes = [permissions.IsAuthenticated]

class AttendanceSessionListCreateView(generics.ListCreateAPIView):
    serializer_class = AttendanceSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = AttendanceSession.objects.filter(period=1)
        date_str = self.request.query_params.get('date')
        if date_str:
            date = parse_date(date_str)
            if date:
                qs = qs.filter(date=date)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = AttendanceSessionSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        teacher = None
        try:
            teacher = request.user.teacher_profile
        except Exception:
            teacher = None

        obj, created = AttendanceSession.objects.get_or_create(
            subject=data.get('subject'),
            date=data.get('date'),
            period=1,
            class_name=data.get('class_name'),
            section=data.get('section'),
            defaults={
                'teacher': teacher,
                'created_by': request.user,
            }
        )

        if not created:
            updated = False
            if teacher and not obj.teacher:
                obj.teacher = teacher
                updated = True
            if updated:
                obj.save(update_fields=['teacher'])

        response_serializer = AttendanceSessionSerializer(obj, context={'request': request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class MarkAttendanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        session_id = request.data.get('session')
        student_id = request.data.get('student')
        status_value = request.data.get('status')
        remarks = request.data.get('remarks', '')

        if not all([session_id, student_id, status_value]):
            return Response({'message': 'session, student, and status are required'}, status=400)

        session = get_object_or_404(AttendanceSession, id=session_id)
        student = get_object_or_404(Student, id=student_id)

        if status_value not in ['present', 'absent', 'late', 'excused']:
            return Response({'message': 'Invalid status value.'}, status=status.HTTP_400_BAD_REQUEST)

        # Determine teacher
        teacher = session.teacher
        if teacher is None:
            try:
                teacher = request.user.teacher_profile
            except Exception:
                teacher = None

        if teacher is None:
            # Fallback: use any active teacher to avoid blocking attendance marking
            try:
                from teachers.models import Teacher
                teacher = Teacher.objects.filter(is_active=True).first()
            except Exception:
                teacher = None

        if teacher is None:
            return Response({'message': 'Teacher is required for marking attendance.'}, status=status.HTTP_400_BAD_REQUEST)

        # Override status if approved leave exists for the student on this date
        leave_exists = LeaveRequest.objects.filter(
            student=student,
            status='approved',
            start_date__lte=session.date,
            end_date__gte=session.date
        ).exists()
        if leave_exists:
            status_value = 'excused'

        try:
            # Use the unique constraint fields for lookup to avoid duplicate insert errors.
            attendance, _created = Attendance.objects.update_or_create(
                student=student,
                subject=session.subject,
                date=session.date,
                defaults={
                    'session': session,
                    'teacher': teacher,
                    'status': status_value,
                    'remarks': remarks,
                    'marked_by': request.user,
                }
            )
        except Exception as exc:
            return Response({'message': f'Failed to mark attendance: {str(exc)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Notify student and parent
        try:
            from notices.utils import dispatch_alert
            if student.user:
                content = f"{session.subject.name if session.subject else 'Subject'} on {session.date}: {status_value.title()}."
                dispatch_alert(student.user, "Attendance Update", content, link="/student/attendance")

            try:
                parent_user = student.parent_profiles.first().user
            except Exception:
                parent_user = None
            if parent_user:
                content = f"{student.student_id} attendance on {session.date}: {status_value.title()}."
                dispatch_alert(parent_user, "Attendance Update", content, link="/parent/attendance", phone=getattr(student, 'guardian_contact', None))
        except Exception:
            pass

        return Response(AttendanceSerializer(attendance).data, status=status.HTTP_201_CREATED)


class MarkAttendanceBulkView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        session_id = request.data.get('session')
        marks = request.data.get('marks') or request.data.get('attendance')

        if not session_id or not isinstance(marks, list) or not marks:
            return Response({'message': 'session and marks list are required'}, status=status.HTTP_400_BAD_REQUEST)

        session = get_object_or_404(AttendanceSession, id=session_id)
        allowed_status = {'present', 'absent', 'late', 'excused'}

        cleaned = []
        student_ids = []
        for item in marks:
            if not isinstance(item, dict):
                continue
            student_id = item.get('student') or item.get('student_id')
            status_value = item.get('status')
            if not student_id or status_value not in allowed_status:
                return Response({'message': 'Invalid student or status in marks list.'}, status=status.HTTP_400_BAD_REQUEST)
            remarks = item.get('remarks', '') or ''
            student_id = int(student_id)
            cleaned.append({'student': student_id, 'status': status_value, 'remarks': remarks})
            student_ids.append(student_id)

        if not cleaned:
            return Response({'message': 'No valid marks provided.'}, status=status.HTTP_400_BAD_REQUEST)

        # Determine teacher
        teacher = session.teacher
        if teacher is None:
            try:
                teacher = request.user.teacher_profile
            except Exception:
                teacher = None
        if teacher is None:
            try:
                from teachers.models import Teacher
                teacher = Teacher.objects.filter(is_active=True).first()
            except Exception:
                teacher = None
        if teacher is None:
            return Response({'message': 'Teacher is required for marking attendance.'}, status=status.HTTP_400_BAD_REQUEST)

        students = Student.objects.filter(id__in=student_ids).select_related('user')
        students_by_id = {s.id: s for s in students}

        leave_ids = set(
            LeaveRequest.objects.filter(
                student_id__in=student_ids,
                status='approved',
                start_date__lte=session.date,
                end_date__gte=session.date,
            ).values_list('student_id', flat=True)
        )

        existing = Attendance.objects.filter(
            student_id__in=student_ids,
            subject=session.subject,
            date=session.date,
        )
        existing_by_student = {a.student_id: a for a in existing}

        new_objs = []
        update_objs = []

        for item in cleaned:
            sid = item['student']
            student = students_by_id.get(sid)
            if not student:
                continue
            status_value = 'excused' if sid in leave_ids else item['status']
            if sid in existing_by_student:
                att = existing_by_student[sid]
                att.session = session
                att.teacher = teacher
                att.status = status_value
                att.remarks = item['remarks']
                att.marked_by = request.user
                update_objs.append(att)
            else:
                new_objs.append(Attendance(
                    session=session,
                    student=student,
                    subject=session.subject,
                    date=session.date,
                    teacher=teacher,
                    status=status_value,
                    remarks=item['remarks'],
                    marked_by=request.user,
                ))

        with transaction.atomic():
            if new_objs:
                Attendance.objects.bulk_create(new_objs)
            if update_objs:
                Attendance.objects.bulk_update(update_objs, ['session', 'teacher', 'status', 'remarks', 'marked_by'])

        # Notify students (in-app only for speed)
        try:
            from notices.models import UserNotification
            notifications = []
            for item in cleaned:
                sid = item['student']
                student = students_by_id.get(sid)
                if not student or not student.user_id:
                    continue
                status_value = 'excused' if sid in leave_ids else item['status']
                content = f"{session.subject.name if session.subject else 'Subject'} on {session.date}: {status_value.title()}."
                notifications.append(UserNotification(
                    user=student.user,
                    title='Attendance Update',
                    content=content,
                    link='/student/attendance',
                ))
            if notifications:
                UserNotification.objects.bulk_create(notifications)
        except Exception:
            pass

        return Response({
            'detail': 'Attendance saved.',
            'created': len(new_objs),
            'updated': len(update_objs),
        }, status=status.HTTP_200_OK)


class LeaveRequestListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (FormParser, MultiPartParser, JSONParser)

    def get_queryset(self):
        user = self.request.user
        qs = LeaveRequest.objects.select_related('student__user', 'approved_by').all()

        if user.role == 'student':
            try:
                student = Student.objects.get(user=user)
            except Student.DoesNotExist:
                return LeaveRequest.objects.none()
            qs = qs.filter(student=student)
        else:
            status_param = self.request.query_params.get('status')
            if status_param in ['pending', 'approved', 'rejected']:
                qs = qs.filter(status=status_param)

            class_param = self.request.query_params.get('class')
            section_param = self.request.query_params.get('section')
            if class_param:
                qs = qs.filter(student__current_class=class_param)
            if section_param:
                qs = qs.filter(student__current_section=section_param)

            date_param = self.request.query_params.get('date')
            if date_param:
                date = parse_date(date_param)
                if date:
                    qs = qs.filter(start_date__lte=date, end_date__gte=date)

            year_param = self.request.query_params.get('year')
            month_param = self.request.query_params.get('month')
            try:
                year = int(year_param) if year_param else None
                month = int(month_param) if month_param else None
            except ValueError:
                year = None
                month = None

            if month:
                if month < 1 or month > 12:
                    return LeaveRequest.objects.none()
                if not year:
                    year = timezone.now().year
                first_day = date_cls(year, month, 1)
                last_day = date_cls(year, month, monthrange(year, month)[1])
                qs = qs.filter(start_date__lte=last_day, end_date__gte=first_day)
            elif year:
                first_day = date_cls(year, 1, 1)
                last_day = date_cls(year, 12, 31)
                qs = qs.filter(start_date__lte=last_day, end_date__gte=first_day)

        return qs

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return LeaveRequestCreateSerializer
        return LeaveRequestSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = LeaveRequestSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        if request.user.role != 'student':
            return Response({'detail': 'Only students can create leave requests.'},
                            status=status.HTTP_403_FORBIDDEN)

        try:
            student = Student.objects.get(user=request.user)
        except Student.DoesNotExist:
            return Response({'detail': 'Student profile not found.'},
                            status=status.HTTP_404_NOT_FOUND)

        serializer = LeaveRequestCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        leave = serializer.save(student=student, status='pending')
        return Response(LeaveRequestSerializer(leave, context={'request': request}).data, status=status.HTTP_201_CREATED)


class LeaveRequestApprovalView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = LeaveRequest.objects.select_related('student__user', 'approved_by').all()
    serializer_class = LeaveRequestSerializer

    def update(self, request, *args, **kwargs):
        if request.user.role not in ['admin', 'teacher']:
            return Response({'detail': 'Only admin or teacher can approve/reject leave requests.'},
                            status=status.HTTP_403_FORBIDDEN)

        leave = self.get_object()
        status_value = request.data.get('status') or request.data.get('approval_status')
        rejection_reason = request.data.get('rejection_reason', '')

        if status_value not in ['approved', 'rejected']:
            return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

        leave.status = status_value
        if status_value == 'approved':
            leave.approved_by = request.user
            leave.approved_at = timezone.now()
            leave.rejection_reason = ''
        else:
            leave.approved_by = None
            leave.approved_at = None
            leave.rejection_reason = rejection_reason

        leave.save()
        # Auto-create excused attendance entries for existing sessions when approved
        if status_value == 'approved':
            sessions = AttendanceSession.objects.filter(
                class_name=leave.student.current_class,
                section=leave.student.current_section,
                date__range=[leave.start_date, leave.end_date],
            ).select_related('subject', 'teacher')

            from teachers.models import Teacher
            fallback_teacher = None
            try:
                fallback_teacher = request.user.teacher_profile
            except Exception:
                fallback_teacher = None

            if fallback_teacher is None:
                fallback_teacher = Teacher.objects.filter(
                    is_active=True,
                    assigned_sections__class_name=leave.student.current_class,
                    assigned_sections__section=leave.student.current_section
                ).first() or Teacher.objects.filter(is_active=True).first()

            for session in sessions:
                teacher = session.teacher or fallback_teacher
                if not teacher:
                    continue
                Attendance.objects.update_or_create(
                    session=session,
                    student=leave.student,
                    date=session.date,
                    subject=session.subject,
                    defaults={
                        'teacher': teacher,
                        'status': 'excused',
                        'remarks': 'Approved leave',
                        'marked_by': request.user,
                    }
                )

        # Notify student
        try:
            from notices.models import UserNotification
            title = f"Leave request {status_value}"
            content = f"Your leave request from {leave.start_date} to {leave.end_date} was {status_value}."
            if status_value == 'rejected' and leave.rejection_reason:
                content += f" Reason: {leave.rejection_reason}"
            UserNotification.objects.create(user=leave.student.user, title=title, content=content, link='/student/leaves')
        except Exception:
            pass

        return Response(LeaveRequestSerializer(leave, context={'request': request}).data, status=status.HTTP_200_OK)


class StudentYearlyProgressView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != 'student':
            return Response({'detail': 'Only students can view their yearly progress.'},
                            status=status.HTTP_403_FORBIDDEN)

        try:
            student = Student.objects.get(user=request.user)
        except Student.DoesNotExist:
            return Response({'detail': 'Student profile not found.'},
                            status=status.HTTP_404_NOT_FOUND)

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


class StudentMonthlyProgressView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != 'student':
            return Response({'detail': 'Only students can view their monthly progress.'},
                            status=status.HTTP_403_FORBIDDEN)

        try:
            student = Student.objects.get(user=request.user)
        except Student.DoesNotExist:
            return Response({'detail': 'Student profile not found.'},
                            status=status.HTTP_404_NOT_FOUND)

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
