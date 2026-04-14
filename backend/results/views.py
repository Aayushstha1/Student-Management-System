from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from students.models import Student
from parents.utils import get_student_for_user
from .models import AcademicYear, Semester, Exam, Result, ClassSubjectAssignment
from .serializers import (
    AcademicYearSerializer,
    SemesterSerializer,
    ExamSerializer,
    ResultSerializer,
    ClassSubjectAssignmentSerializer,
)
from .utils import normalize_class_section
from django.db.models import Q
import re


class AcademicYearListCreateView(generics.ListCreateAPIView):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = [permissions.IsAuthenticated]


class AcademicYearDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = [permissions.IsAuthenticated]


class SemesterListCreateView(generics.ListCreateAPIView):
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer
    permission_classes = [permissions.IsAuthenticated]


class SemesterDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer
    permission_classes = [permissions.IsAuthenticated]


class ExamListCreateView(generics.ListCreateAPIView):
    queryset = Exam.objects.all()
    serializer_class = ExamSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Exam.objects.all()
        class_name = self.request.query_params.get('class_name') or self.request.query_params.get('class')
        section = self.request.query_params.get('section')

        user = self.request.user
        if getattr(user, 'role', None) in ['student', 'parent']:
            student = get_student_for_user(user)
            if not student:
                return Exam.objects.none()
            class_name = student.current_class
            section = student.current_section

        if class_name:
            class_name, section = normalize_class_section(class_name, section)
            qs = qs.filter(class_name__iexact=class_name)
            if section:
                qs = qs.filter(Q(section__iexact=section) | Q(section__isnull=True) | Q(section=''))
            else:
                qs = qs.filter(Q(section__isnull=True) | Q(section=''))
        return qs


class ExamDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Exam.objects.all()
    serializer_class = ExamSerializer
    permission_classes = [permissions.IsAuthenticated]


class ResultListCreateView(generics.ListCreateAPIView):
    queryset = Result.objects.all()
    serializer_class = ResultSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        # Students see only approved results
        if getattr(user, 'role', None) == 'student':
            return Result.objects.filter(student__user=user, status='approved')
        # Teachers see their own published and pending results
        if getattr(user, 'role', None) == 'teacher':
            return Result.objects.filter(published_by=user).exclude(status='draft')
        # Admins see all non-draft results
        if getattr(user, 'role', None) == 'admin':
            return Result.objects.exclude(status='draft')
        return Result.objects.none()
    
    def perform_create(self, serializer):
        user = self.request.user
        if getattr(user, 'role', None) not in ['teacher', 'admin']:
            raise PermissionDenied('Only teachers or admins can create results.')
        status_value = 'draft'
        published_at = None
        approved_by = None
        approved_at = None

        if getattr(user, 'role', None) == 'teacher':
            status_value = 'pending_approval'
            published_at = timezone.now()
        elif getattr(user, 'role', None) == 'admin':
            status_value = 'approved'
            published_at = timezone.now()
            approved_by = user
            approved_at = timezone.now()

        result = serializer.save(
            published_by=user,
            status=status_value,
            published_at=published_at,
            approved_by=approved_by,
            approved_at=approved_at
        )

        # If admin created an approved result, notify the student
        if status_value == 'approved':
            try:
                from notices.models import UserNotification
                if result.student and result.student.user:
                    class_part = f"{result.student.current_class}{(' ' + result.student.current_section) if result.student.current_section else ''}"
                    title = "Result Published"
                    content = f"Your result for {result.exam.name if result.exam else 'Exam'} (Class {class_part}) has been published."
                    UserNotification.objects.create(
                        user=result.student.user,
                        title=title,
                        content=content,
                        link="/student/report-card"
                    )
            except Exception:
                pass


class ResultDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Result.objects.all()
    serializer_class = ResultSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def update(self, request, *args, **kwargs):
        result = self.get_object()
        # Only teachers can edit draft results
        if result.published_by != request.user or result.status != 'draft':
            return Response({'detail': 'You can only edit your own draft results.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class PublishResultsView(generics.GenericAPIView):
    """
    Teacher publishes results for a class/exam
    """
    serializer_class = ResultSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        exam_id = request.data.get('exam_id')
        class_id = request.data.get('class')
        section = request.data.get('section')
        if not exam_id:
            return Response({'detail': 'exam_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get all draft results for this exam published by this teacher
        results = Result.objects.filter(exam_id=exam_id, published_by=request.user, status='draft')
        if class_id:
            results = results.filter(student__current_class=class_id)
        if section is not None:
            results = results.filter(student__current_section=section)
        
        if not results.exists():
            return Response({'detail': 'No draft results to publish.'}, status=status.HTTP_404_NOT_FOUND)
        
        # Update status to pending_approval
        results.update(status='pending_approval', published_at=timezone.now())
        
        return Response({
            'detail': f'{results.count()} results published and pending approval',
            'count': results.count()
        }, status=status.HTTP_200_OK)


class ApproveResultsView(generics.GenericAPIView):
    """
    Admin approves results for a class/exam
    """
    serializer_class = ResultSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        exam_id = request.data.get('exam')
        class_id = request.data.get('class')
        section = request.data.get('section')
        action_type = request.data.get('action')  # 'approve' or 'reject'
        approval_remarks = request.data.get('remarks', '')
        
        if not exam_id or not action_type:
            return Response({'detail': 'exam and action are required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get all pending results for this exam and class
        results = Result.objects.filter(exam_id=exam_id, status='pending_approval')
        
        if class_id:
            results = results.filter(student__current_class=class_id)
        if section is not None:
            results = results.filter(student__current_section=section)
        
        if not results.exists():
            return Response({'detail': 'No pending results to approve.'}, status=status.HTTP_404_NOT_FOUND)
        
        if action_type == 'approve':
            student_ids = list(results.values_list('student_id', flat=True).distinct())
            results.update(
                status='approved',
                approved_by=request.user,
                approved_at=timezone.now(),
                approval_remarks=approval_remarks
            )
            # Create notifications for students
            try:
                from notices.models import UserNotification
                exam_name = None
                try:
                    exam_name = Exam.objects.get(pk=exam_id).name
                except Exception:
                    exam_name = f"Exam {exam_id}"

                section_part = f" {section}" if section else ""
                class_part = f"{class_id}{section_part}" if class_id else "your class"
                title = "Result Published"
                content = f"Your result for {exam_name} (Class {class_part}) has been published."

                students = Student.objects.filter(id__in=student_ids).select_related('user')
                for student in students:
                    if not student.user_id:
                        continue
                    UserNotification.objects.create(
                        user=student.user,
                        title=title,
                        content=content,
                        link="/student/report-card"
                    )
            except Exception:
                pass
            return Response({
                'detail': f'{results.count()} results approved',
                'count': results.count()
            }, status=status.HTTP_200_OK)
        
        elif action_type == 'reject':
            results.update(
                status='rejected',
                approval_remarks=approval_remarks
            )
            return Response({
                'detail': f'{results.count()} results rejected',
                'count': results.count()
            }, status=status.HTTP_200_OK)
        
        return Response({'detail': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)


class TopicAnalyticsView(generics.GenericAPIView):
    """
    Topic-wise performance analytics for a class/section/subject.
    Groups approved results by exam.topic (fallback to exam.name).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) not in ['admin', 'teacher']:
            return Response({'detail': 'Only admin or teacher can view analytics.'}, status=status.HTTP_403_FORBIDDEN)
        class_name = request.query_params.get('class')
        section = request.query_params.get('section')
        subject_id = request.query_params.get('subject')

        qs = Result.objects.filter(status='approved').select_related('exam', 'exam__subject', 'student')
        if class_name:
            qs = qs.filter(student__current_class=class_name)
        if section is not None:
            qs = qs.filter(student__current_section=section)
        if subject_id:
            qs = qs.filter(exam__subject_id=subject_id)

        stats = {}
        for result in qs:
            exam = result.exam
            if not exam:
                continue
            topic = (exam.topic or exam.name or 'Topic').strip()
            key = (exam.subject_id, topic)
            total_marks = float(exam.total_marks or 0)
            obtained = float(result.marks_obtained or 0)
            percentage = (obtained / total_marks) * 100 if total_marks > 0 else 0

            if key not in stats:
                stats[key] = {
                    'topic': topic,
                    'subject_id': exam.subject_id,
                    'subject_name': exam.subject.name if exam.subject else '',
                    'count': 0,
                    'avg_marks': 0.0,
                    'avg_percentage': 0.0,
                    'max_percentage': 0.0,
                    'min_percentage': 100.0,
                }

            entry = stats[key]
            entry['count'] += 1
            entry['avg_marks'] += obtained
            entry['avg_percentage'] += percentage
            entry['max_percentage'] = max(entry['max_percentage'], percentage)
            entry['min_percentage'] = min(entry['min_percentage'], percentage)

        results = []
        for entry in stats.values():
            count = entry['count'] or 1
            entry['avg_marks'] = round(entry['avg_marks'] / count, 2)
            entry['avg_percentage'] = round(entry['avg_percentage'] / count, 2)
            entry['min_percentage'] = 0.0 if entry['min_percentage'] == 100.0 and entry['max_percentage'] == 0.0 else round(entry['min_percentage'], 2)
            results.append(entry)

        results.sort(key=lambda x: x['avg_percentage'], reverse=True)
        return Response(results, status=status.HTTP_200_OK)


class ClassSubjectAssignmentListCreateView(generics.ListCreateAPIView):
    serializer_class = ClassSubjectAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = ClassSubjectAssignment.objects.select_related('subject', 'teacher', 'teacher__user').all()
        class_name = (self.request.query_params.get('class_name') or '').strip()
        section_param = self.request.query_params.get('section')
        section = section_param.strip() if section_param is not None else None
        is_active = self.request.query_params.get('is_active')

        def normalize_class(value):
            value = (value or '').strip()
            if not value:
                return ''
            value = re.sub(r'^(class|cls)\s*[-:_]*\s*', '', value, flags=re.IGNORECASE)
            value = re.sub(r'[/_-]+', ' ', value)
            value = re.sub(r'(\d)([A-Za-z])', r'\1 \2', value)
            value = re.sub(r'\s+', ' ', value).strip()
            return value

        def split_class_section(value):
            value = normalize_class(value)
            if not value:
                return ('', '')
            parts = value.split(' ')
            if value[:1].isdigit() and len(parts) > 1:
                last = parts[-1]
                if re.fullmatch(r'[A-Za-z]{1,3}', last):
                    return (' '.join(parts[:-1]).strip(), last.upper())
            return (value, '')

        def add_candidates(value, bucket):
            value = normalize_class(value)
            if not value:
                return
            no_space = value.replace(' ', '')
            with_underscore = value.replace(' ', '_')
            bucket.add(value)
            bucket.add(no_space)
            bucket.add(value.replace(' ', '-'))
            bucket.add(with_underscore)
            bucket.add(value.replace(' ', '/'))
            bucket.add(f"Class {value}")
            bucket.add(f"Class {no_space}")
            bucket.add(f"Class-{no_space}")
            bucket.add(f"Class_{no_space}")
            bucket.add(f"Class_{with_underscore}")

        derived_section = ''
        class_only = ''
        if class_name:
            class_only, derived_section = split_class_section(class_name)

            candidates = set()
            add_candidates(class_name, candidates)
            if class_only and class_only != class_name:
                add_candidates(class_only, candidates)
            if section:
                add_candidates(f"{class_name} {section}", candidates)
                if class_only:
                    add_candidates(f"{class_only} {section}", candidates)
            if candidates:
                q = Q()
                for value in candidates:
                    q |= Q(class_name__iexact=value)
                qs = qs.filter(q)

        effective_section = section
        if (effective_section is None or effective_section == '') and derived_section:
            effective_section = derived_section

        if effective_section is not None and effective_section != '':
            section_value = effective_section.strip().upper()
            # Include class-wide subjects (empty section) and section-specific matches
            qs = qs.filter(Q(section__iexact=section_value) | Q(section__isnull=True) | Q(section__exact=''))
        elif effective_section == '':
            # If section explicitly blank, keep blank/NULL only
            qs = qs.filter(Q(section__isnull=True) | Q(section__exact=''))

        if is_active is not None:
            qs = qs.filter(is_active=str(is_active).lower() in ['1', 'true', 'yes'])

        user = self.request.user
        if getattr(user, 'role', None) == 'teacher' and hasattr(user, 'teacher_profile'):
            qs = qs.filter(teacher=user.teacher_profile, is_active=True)
        elif getattr(user, 'role', None) == 'student':
            try:
                student = Student.objects.get(user=user)
                qs = qs.filter(class_name=student.current_class, section=student.current_section, is_active=True)
            except Student.DoesNotExist:
                return ClassSubjectAssignment.objects.none()

        return qs

    def perform_create(self, serializer):
        if getattr(self.request.user, 'role', None) != 'admin':
            raise PermissionDenied('Only administrators can create class subject assignments.')
        serializer.save()


class ClassSubjectAssignmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ClassSubjectAssignment.objects.select_related('subject', 'teacher', 'teacher__user').all()
    serializer_class = ClassSubjectAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_update(self, serializer):
        if getattr(self.request.user, 'role', None) != 'admin':
            raise PermissionDenied('Only administrators can update class subject assignments.')
        serializer.save()

    def perform_destroy(self, instance):
        if getattr(self.request.user, 'role', None) != 'admin':
            raise PermissionDenied('Only administrators can delete class subject assignments.')
        instance.delete()

