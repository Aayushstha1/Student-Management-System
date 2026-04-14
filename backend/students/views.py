from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from .models import Student, StudentPasswordResetRequest, StudentEmailChangeRequest, ConsentRequest
from .serializers import (
    StudentSerializer, StudentCreateSerializer, StudentSearchSerializer,
    StudentProfileSerializer, StudentProfileUpdateSerializer,
    StudentPasswordResetRequestCreateSerializer, StudentPasswordResetRequestSerializer,
    StudentEmailChangeRequestCreateSerializer, StudentEmailChangeRequestSerializer,
    ConsentRequestSerializer
)
import logging
from parents.utils import get_student_for_user
from decimal import Decimal
from django.utils.dateparse import parse_date, parse_time
import uuid

User = get_user_model()


class StudentListCreateView(generics.ListCreateAPIView):
    """
    View for listing and creating students
    """
    queryset = Student.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return StudentCreateSerializer
        return StudentSerializer
    
    def get_queryset(self):
        queryset = Student.objects.select_related('user').all()
        
        # Filter by class if provided
        current_class = self.request.query_params.get('class', None)
        if current_class:
            queryset = queryset.filter(current_class=current_class)
        
        # Filter by section if provided
        section = self.request.query_params.get('section', None)
        if section:
            queryset = queryset.filter(current_section=section)
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        # Defensive: catch unexpected serialization errors to avoid 500s without logs
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            logging.exception('Failed to list students')
            return Response({'error': 'Internal server error while listing students'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def perform_create(self, serializer):
        # Only admin can create students
        from rest_framework.exceptions import PermissionDenied
        if self.request.user.role != 'admin':
            raise PermissionDenied('Permission denied')
        serializer.save()


class StudentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    View for retrieving, updating, and deleting a student
    """
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Students can only view their own profile, admin and teachers can view all
        if self.request.user.role == 'admin' or self.request.user.role == 'teacher':
            return Student.objects.select_related('user').all()
        elif self.request.user.role == 'student':
            try:
                return Student.objects.select_related('user').filter(user=self.request.user)
            except Student.DoesNotExist:
                return Student.objects.none()
        return Student.objects.none()


class StudentQRCodeView(generics.RetrieveAPIView):
    """
    View for retrieving student QR code data
    """
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def retrieve(self, request, *args, **kwargs):
        student = self.get_object()
        
        # Check permissions
        if (request.user.role not in ['admin', 'teacher'] and 
            student.user != request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Ensure QR is refreshed with latest data and correct public URL payload
        try:
            base_url = getattr(settings, 'FRONTEND_URL', None)
            student.generate_qr_code(base_url=base_url)
            student.save()
        except Exception:
            if not student.qr_code:
                base_url = getattr(settings, 'FRONTEND_URL', None)
                student.generate_qr_code(base_url=base_url)
                student.save()

        qr_data = student.get_qr_code_data()
        # Also include absolute URL to QR image when possible
        request_obj = request
        if student.qr_code:
            try:
                qr_url = student.qr_code.url
                # cache-bust to avoid stale QR images
                if student.updated_at:
                    sep = '&' if '?' in qr_url else '?'
                    qr_url = f"{qr_url}{sep}v={int(student.updated_at.timestamp())}"
                if request_obj:
                    qr_url = request_obj.build_absolute_uri(qr_url)
                qr_data['qr_code_url'] = qr_url
            except Exception:
                pass

        # Also include a profile URL for the frontend if configured
        try:
            from django.conf import settings
            qr_data['profile_url'] = f"{getattr(settings, 'FRONTEND_URL', '').rstrip('/')}" + f"/public/student/{student.student_id}"
        except Exception:
            pass

        return Response(qr_data)


class StudentSearchView(generics.ListAPIView):
    """
    View for searching students
    """
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        query = self.request.query_params.get('query', '')
        class_filter = self.request.query_params.get('class', None)
        section_filter = self.request.query_params.get('section', None)
        
        queryset = Student.objects.select_related('user').all()
        
        if query:
            queryset = queryset.filter(
                Q(student_id__icontains=query) |
                Q(user__first_name__icontains=query) |
                Q(user__last_name__icontains=query) |
                Q(user__username__icontains=query) |
                Q(current_class__icontains=query) |
                Q(roll_number__icontains=query)
            )
        
        if class_filter:
            queryset = queryset.filter(current_class=class_filter)

        if section_filter:
            queryset = queryset.filter(current_section=section_filter)
        
        return queryset


class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, 'role', None) == 'admin')


class StudentPasswordResetRequestListCreateView(generics.ListCreateAPIView):
    """
    GET (admin): list requests
    POST (public): submit a request
    """
    serializer_class = StudentPasswordResetRequestSerializer
    permission_classes = [permissions.AllowAny]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAdminUser()]
        return [permissions.AllowAny()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return StudentPasswordResetRequestCreateSerializer
        return StudentPasswordResetRequestSerializer

    def get_queryset(self):
        qs = StudentPasswordResetRequest.objects.select_related('student', 'student__user', 'reviewed_by').all()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data.get('username')
        class_name = serializer.validated_data.get('class_name')
        father_name = serializer.validated_data.get('father_name')
        email = serializer.validated_data.get('email')

        existing = StudentPasswordResetRequest.objects.filter(
            status='pending',
            username__iexact=username,
            class_name__iexact=class_name,
            father_name__iexact=father_name,
            email__iexact=email,
        ).order_by('-requested_at').first()

        if existing:
            data = StudentPasswordResetRequestSerializer(existing).data
            return Response({'detail': 'Request already pending. Please wait for admin approval.', 'request': data}, status=status.HTTP_200_OK)

        obj = serializer.save()
        data = StudentPasswordResetRequestSerializer(obj).data
        return Response({'detail': 'Request submitted. Admin will review it shortly.', 'request': data}, status=status.HTTP_201_CREATED)


class StudentPasswordResetRequestApproveView(generics.GenericAPIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            req = StudentPasswordResetRequest.objects.select_related('student', 'student__user').get(pk=pk)
        except StudentPasswordResetRequest.DoesNotExist:
            return Response({'detail': 'Request not found.'}, status=status.HTTP_404_NOT_FOUND)

        if req.status != 'pending':
            return Response({'detail': f'Request already {req.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        if not req.student:
            return Response({'detail': 'No matching student found for this request.'}, status=status.HTTP_400_BAD_REQUEST)

        password = (request.data.get('password') or '').strip()
        password_confirm = (request.data.get('password_confirm') or '').strip()

        if not password:
            return Response({'detail': 'Password is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if password != password_confirm:
            return Response({'detail': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 6:
            return Response({'detail': 'Password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        user = req.student.user
        if not user or not user.email:
            return Response({'detail': 'Student email is not set.'}, status=status.HTTP_400_BAD_REQUEST)

        subject = "Your Student Account Password Reset"
        user.set_password(password)
        user.save()

        message = (
            "Your password has been reset by the administrator.\n"
            f"Your new password is: {password}\n"
            "Please log in and change your password immediately."
        )

        sent = send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=[user.email],
            fail_silently=False,
        )
        if sent == 0:
            return Response({'detail': 'Email not sent. Check SMTP settings.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        req.status = 'approved'
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])

        return Response({'detail': 'Password updated and emailed to student.'}, status=status.HTTP_200_OK)


class StudentPasswordResetRequestRejectView(generics.GenericAPIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            req = StudentPasswordResetRequest.objects.get(pk=pk)
        except StudentPasswordResetRequest.DoesNotExist:
            return Response({'detail': 'Request not found.'}, status=status.HTTP_404_NOT_FOUND)

        if req.status != 'pending':
            return Response({'detail': f'Request already {req.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        note = (request.data.get('note') or '').strip()
        req.status = 'rejected'
        req.note = note
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.save(update_fields=['status', 'note', 'reviewed_by', 'reviewed_at'])

        return Response({'detail': 'Request rejected.'}, status=status.HTTP_200_OK)


class StudentEmailChangeRequestListCreateView(generics.ListCreateAPIView):
    """
    GET: admin sees all requests, student sees their own
    POST: student submits a new email change request
    """
    serializer_class = StudentEmailChangeRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return StudentEmailChangeRequestCreateSerializer
        return StudentEmailChangeRequestSerializer

    def get_queryset(self):
        qs = StudentEmailChangeRequest.objects.select_related('student', 'student__user', 'reviewed_by').all()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        role = getattr(self.request.user, 'role', None)
        if role == 'admin':
            return qs
        if role == 'student':
            return qs.filter(student__user=self.request.user)
        return StudentEmailChangeRequest.objects.none()

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'student':
            return Response({'detail': 'Only students can request email change.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            student = Student.objects.select_related('user').get(user=request.user)
        except Student.DoesNotExist:
            return Response({'detail': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        new_email = serializer.validated_data.get('new_email')

        existing = StudentEmailChangeRequest.objects.filter(
            student=student, status='pending'
        ).order_by('-requested_at').first()
        if existing:
            data = StudentEmailChangeRequestSerializer(existing).data
            return Response({'detail': 'Request already pending. Please wait for admin approval.', 'request': data}, status=status.HTTP_200_OK)

        obj = StudentEmailChangeRequest.objects.create(student=student, new_email=new_email, status='pending')

        try:
            from notices.utils import dispatch_alert
            from accounts.models import User as AccountUser
            admins = AccountUser.objects.filter(role='admin')
            for admin in admins:
                dispatch_alert(
                    admin,
                    'Email Change Request',
                    f"{student.user.get_full_name()} requested email change to {new_email}.",
                    link='/admin/email-change-requests'
                )
        except Exception:
            pass

        return Response(StudentEmailChangeRequestSerializer(obj).data, status=status.HTTP_201_CREATED)


class StudentEmailChangeRequestApproveView(generics.GenericAPIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            req = StudentEmailChangeRequest.objects.select_related('student', 'student__user').get(pk=pk)
        except StudentEmailChangeRequest.DoesNotExist:
            return Response({'detail': 'Request not found.'}, status=status.HTTP_404_NOT_FOUND)

        if req.status != 'pending':
            return Response({'detail': f'Request already {req.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        student = req.student
        user = student.user if student else None
        if not user:
            return Response({'detail': 'Student user not found.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=req.new_email).exclude(pk=user.pk).exists():
            return Response({'detail': 'This email is already used by another account.'}, status=status.HTTP_400_BAD_REQUEST)

        user.email = req.new_email
        user.save(update_fields=['email'])

        req.status = 'approved'
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])

        try:
            # Confirmation email to the new address
            try:
                send_mail(
                    subject='Email Change Approved',
                    message=(
                        "Your student account email has been updated.\n"
                        f"New email: {req.new_email}\n"
                        "If you did not request this change, please contact the school admin immediately."
                    ),
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
                    recipient_list=[req.new_email],
                    fail_silently=False,
                )
            except Exception:
                pass

            from notices.utils import dispatch_alert
            dispatch_alert(user, 'Email Change Approved', f"Your email was updated to {req.new_email}.", link='/student/profile')
            try:
                parent_user = student.parent_profiles.first().user
            except Exception:
                parent_user = None
            if parent_user:
                dispatch_alert(parent_user, 'Student Email Updated', f"{student.user.get_full_name()} updated email to {req.new_email}.", link='/parent/profile')
        except Exception:
            pass

        return Response({'detail': 'Email updated.', 'request': StudentEmailChangeRequestSerializer(req).data}, status=status.HTTP_200_OK)


class StudentEmailChangeRequestRejectView(generics.GenericAPIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            req = StudentEmailChangeRequest.objects.get(pk=pk)
        except StudentEmailChangeRequest.DoesNotExist:
            return Response({'detail': 'Request not found.'}, status=status.HTTP_404_NOT_FOUND)

        if req.status != 'pending':
            return Response({'detail': f'Request already {req.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        note = (request.data.get('note') or '').strip()
        req.status = 'rejected'
        req.note = note
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.save(update_fields=['status', 'note', 'reviewed_by', 'reviewed_at'])

        try:
            from notices.utils import dispatch_alert
            if req.student and req.student.user:
                dispatch_alert(req.student.user, 'Email Change Rejected', note or 'Your email change request was rejected.', link='/student/profile')
        except Exception:
            pass

        return Response({'detail': 'Request rejected.'}, status=status.HTTP_200_OK)


class ConsentRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = ConsentRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = ConsentRequest.objects.select_related('student', 'student__user', 'submitted_by', 'reviewed_by').all()
        user = self.request.user
        role = getattr(user, 'role', None)
        if role in ['student', 'parent']:
            student = get_student_for_user(user)
            if not student:
                return ConsentRequest.objects.none()
            qs = qs.filter(student=student)
        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        role = getattr(user, 'role', None)
        data = request.data.copy()

        student = None
        if role == 'student':
            student = get_student_for_user(user)
        elif role == 'parent':
            student = get_student_for_user(user)
        else:
            student_id = data.get('student')
            if student_id:
                try:
                    student = Student.objects.get(pk=student_id)
                except Student.DoesNotExist:
                    student = None

        if not student:
            return Response({'detail': 'Student is required.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(student=student, submitted_by=user, status='pending')

        # Notify parent
        try:
            from notices.utils import dispatch_alert
            try:
                parent_user = student.parent_profiles.first().user
            except Exception:
                parent_user = None
            if parent_user:
                dispatch_alert(parent_user, 'Consent Request', obj.title, link='/parent/consents')
        except Exception:
            pass

        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED)


class ConsentRequestApproveView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            obj = ConsentRequest.objects.select_related('student', 'student__user').get(pk=pk)
        except ConsentRequest.DoesNotExist:
            return Response({'detail': 'Consent request not found.'}, status=status.HTTP_404_NOT_FOUND)

        if obj.status != 'pending':
            return Response({'detail': f'Request already {obj.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        role = getattr(user, 'role', None)
        if role == 'parent':
            student = get_student_for_user(user)
            if not student or student.id != obj.student_id:
                return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        elif role != 'admin':
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        obj.status = 'approved'
        obj.reviewed_by = user
        obj.reviewed_at = timezone.now()
        obj.rejection_reason = ''
        obj.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'rejection_reason'])

        try:
            from notices.utils import dispatch_alert
            if obj.student and obj.student.user:
                if role == 'parent':
                    dispatch_alert(
                        obj.student.user,
                        'Consent Approved',
                        f"Parent approved: {obj.title}",
                        link='/student/consents'
                    )
                else:
                    dispatch_alert(obj.student.user, 'Consent Approved', obj.title, link='/student/consents')
        except Exception:
            pass

        return Response(ConsentRequestSerializer(obj).data, status=status.HTTP_200_OK)


class ConsentRequestRejectView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            obj = ConsentRequest.objects.select_related('student', 'student__user').get(pk=pk)
        except ConsentRequest.DoesNotExist:
            return Response({'detail': 'Consent request not found.'}, status=status.HTTP_404_NOT_FOUND)

        if obj.status != 'pending':
            return Response({'detail': f'Request already {obj.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        role = getattr(user, 'role', None)
        if role == 'parent':
            student = get_student_for_user(user)
            if not student or student.id != obj.student_id:
                return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        elif role != 'admin':
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        reason = (request.data.get('reason') or '').strip()
        obj.status = 'rejected'
        obj.reviewed_by = user
        obj.reviewed_at = timezone.now()
        obj.rejection_reason = reason
        obj.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'rejection_reason'])

        try:
            from notices.utils import dispatch_alert
            if obj.student and obj.student.user:
                dispatch_alert(obj.student.user, 'Consent Rejected', obj.title, link='/student/consents')
        except Exception:
            pass

        return Response(ConsentRequestSerializer(obj).data, status=status.HTTP_200_OK)


class TripEventListCreateView(APIView):
    """
    Admin creates trip events and broadcasts to students.
    All authenticated roles can view trip events and participant responses.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        role = getattr(request.user, 'role', None)
        self_student = None
        qs = ConsentRequest.objects.filter(request_type='trip', event_id__isnull=False).select_related(
            'student', 'student__user'
        )

        if role in ['student', 'parent']:
            self_student = get_student_for_user(request.user)
            if not self_student:
                return Response([], status=status.HTTP_200_OK)
            event_ids = ConsentRequest.objects.filter(
                student=self_student,
                request_type='trip',
                event_id__isnull=False,
            ).values_list('event_id', flat=True)
            qs = qs.filter(event_id__in=event_ids)

        events = {}
        for c in qs:
            key = str(c.event_id)
            if key not in events:
                events[key] = {
                    'event_id': key,
                    'title': c.title,
                    'details': c.details,
                    'location': c.location,
                    'amount': str(c.amount) if c.amount is not None else None,
                    'start_date': c.start_date,
                    'end_date': c.end_date,
                    'start_time': c.start_time,
                    'end_time': c.end_time,
                    'created_at': c.created_at,
                    'stats': {'total': 0, 'approved': 0, 'rejected': 0, 'pending': 0},
                    'responses': [],
                }
            event = events[key]
            event['stats']['total'] += 1
            if c.status in event['stats']:
                event['stats'][c.status] += 1
            else:
                event['stats']['pending'] += 1

            event['responses'].append({
                'id': c.id,
                'student_id': c.student.student_id,
                'student_name': c.student.user.get_full_name(),
                'class_name': c.student.current_class,
                'section': c.student.current_section,
                'status': c.status,
                'rejection_reason': c.rejection_reason,
                'is_self': bool(self_student and c.student_id == self_student.id),
            })

        result = list(events.values())
        result.sort(key=lambda e: (e['start_date'] or timezone.now().date()), reverse=True)
        return Response(result, status=status.HTTP_200_OK)

    def post(self, request):
        if getattr(request.user, 'role', None) != 'admin':
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data or {}
        title = (data.get('title') or '').strip()
        details = (data.get('details') or '').strip()
        location = (data.get('location') or '').strip()
        start_date = data.get('start_date') or data.get('date')
        end_date = data.get('end_date') or start_date
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        amount = data.get('amount')
        send_to_all = str(data.get('send_to_all', 'true')).lower() in ['1', 'true', 'yes']
        class_name = (data.get('class_name') or '').strip()
        section = (data.get('section') or '').strip()

        if not title or not start_date:
            return Response({'detail': 'Title and date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        start_date_parsed = parse_date(start_date) if isinstance(start_date, str) else start_date
        end_date_parsed = parse_date(end_date) if isinstance(end_date, str) else end_date
        if not start_date_parsed:
            return Response({'detail': 'Invalid start date.'}, status=status.HTTP_400_BAD_REQUEST)
        if end_date and not end_date_parsed:
            return Response({'detail': 'Invalid end date.'}, status=status.HTTP_400_BAD_REQUEST)

        start_time_parsed = parse_time(start_time) if start_time else None
        end_time_parsed = parse_time(end_time) if end_time else None

        if send_to_all:
            students = Student.objects.select_related('user').all()
        else:
            if not class_name:
                return Response({'detail': 'Class name is required when send_to_all is false.'}, status=status.HTTP_400_BAD_REQUEST)
            students = Student.objects.select_related('user').filter(current_class__iexact=class_name)
            if section:
                students = students.filter(current_section__iexact=section)

        if not students.exists():
            return Response({'detail': 'No students found for the selected class/section.'}, status=status.HTTP_400_BAD_REQUEST)

        amount_value = None
        if amount not in [None, '']:
            try:
                amount_value = Decimal(str(amount))
            except Exception:
                return Response({'detail': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)

        event_id = uuid.uuid4()
        created = []
        for student in students:
            created.append(ConsentRequest(
                student=student,
                request_type='trip',
                title=title,
                details=details,
                start_date=start_date_parsed,
                end_date=end_date_parsed,
                location=location,
                amount=amount_value,
                start_time=start_time_parsed,
                end_time=end_time_parsed,
                event_id=event_id,
                status='pending',
                submitted_by=request.user,
            ))
        ConsentRequest.objects.bulk_create(created)

        try:
            from notices.utils import dispatch_alert
            for student in students:
                try:
                    parent_user = student.parent_profiles.first().user
                except Exception:
                    parent_user = None
                if parent_user:
                    dispatch_alert(
                        parent_user,
                        'Field Trip Consent',
                        f"{title} on {start_date}. Please review.",
                        link='/parent/consents',
                    )
        except Exception:
            pass

        return Response({'detail': 'Trip consent sent.', 'event_id': str(event_id)}, status=status.HTTP_201_CREATED)


class PublicStudentProfileView(generics.RetrieveAPIView):
    """
    Public profile view for students (safe, non-sensitive)
    """
    queryset = Student.objects.all()
    permission_classes = [permissions.AllowAny]

    def get(self, request, student_id, *args, **kwargs):
        try:
            student = Student.objects.get(student_id=student_id)
        except Student.DoesNotExist:
            return Response({'detail': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

        data = student.get_qr_code_data()
        # Do not include any sensitive user fields like email/password
        safe_user = {
            'first_name': student.user.first_name,
            'last_name': student.user.last_name,
            'profile_picture': student.user.profile_picture.url if student.user.profile_picture else None,
        }
        data['user'] = safe_user
        return Response(data)


class StudentProfileView(generics.RetrieveUpdateAPIView):
    """
    View for student to view and edit their profile
    """
    serializer_class = StudentProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    
    def get_object(self):
        # Students can only access their own profile
        if self.request.user.role == 'student':
            try:
                return Student.objects.get(user=self.request.user)
            except Student.DoesNotExist:
                return None
        # Admin can access any student profile
        elif self.request.user.role == 'admin':
            student_id = self.kwargs.get('pk')
            try:
                return Student.objects.get(pk=student_id)
            except Student.DoesNotExist:
                return None
        return None
    
    def get(self, request, *args, **kwargs):
        obj = self.get_object()
        if not obj:
            return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(obj)
        return Response(serializer.data)
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return StudentProfileUpdateSerializer
        return StudentProfileSerializer
    
    def put(self, request, *args, **kwargs):
        obj = self.get_object()
        if not obj:
            return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = StudentProfileUpdateSerializer(obj, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            # Return the updated profile with full details
            profile_serializer = StudentProfileSerializer(obj, context={'request': request})
            return Response(profile_serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def patch(self, request, *args, **kwargs):
        obj = self.get_object()
        if not obj:
            return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = StudentProfileUpdateSerializer(obj, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            # Return the updated profile with full details
            profile_serializer = StudentProfileSerializer(obj, context={'request': request})
            return Response(profile_serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StudentProfilePictureUploadView(generics.UpdateAPIView):
    """
    View for uploading student profile picture (by admin or student)
    """
    queryset = Student.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)
    
    def put(self, request, *args, **kwargs):
        """Allow profile picture upload"""
        student_id = kwargs.get('pk')
        
        try:
            student = Student.objects.get(pk=student_id)
        except Student.DoesNotExist:
            return Response({'detail': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check permissions: student can upload their own, admin can upload anyone's
        if request.user.role == 'student' and student.user != request.user:
            return Response({'detail': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Check if profile_picture is in the request
        if 'profile_picture' not in request.FILES:
            return Response(
                {'detail': 'No profile_picture file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        profile_picture = request.FILES['profile_picture']
        student.profile_picture = profile_picture
        student.save()
        
        serializer = StudentProfileSerializer(student, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


# ------------------ CV Views ------------------
from .serializers import CVSerializer, CVCreateUpdateSerializer
from .models import CV
from django.utils import timezone

class IsOwnerOrReadForStaffTeacher(permissions.BasePermission):
    """Owner has full control, admin has full control, teacher has read-only access."""
    def has_object_permission(self, request, view, obj):
        # Admins have full access
        if request.user.role == 'admin':
            return True
        if request.method in permissions.SAFE_METHODS:
            # allow read if owner or teacher
            return obj.owner == request.user or request.user.role == 'teacher'
        # write operations allowed only for owner
        return obj.owner == request.user

class CVListCreateView(generics.ListCreateAPIView):
    serializer_class = CVSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'teacher']:
            return CV.objects.select_related('owner').all()
        return CV.objects.filter(owner=user)

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return CVCreateUpdateSerializer
        return CVSerializer

    def create(self, request, *args, **kwargs):
        # use the create/update serializer for validation and file handling
        serializer = CVCreateUpdateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(owner=request.user)
        response_serializer = CVSerializer(obj, context={'request': request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class CVRatingCreateView(generics.CreateAPIView):
    """Create or update a rating for a CV by admin/teacher/student"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = None

    def post(self, request, pk):
        from .serializers import CVRatingSerializer
        try:
            cv = CV.objects.get(pk=pk)
        except CV.DoesNotExist:
            return Response({'detail': 'CV not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CVRatingSerializer(data={**request.data, 'cv': cv.id}, context={'request': request})
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        return Response(CVRatingSerializer(obj).data, status=status.HTTP_201_CREATED)


class CVRatingDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = None

    def get_object(self):
        from students.cv import CVRating
        try:
            return CVRating.objects.get(pk=self.kwargs.get('rating_pk'))
        except CVRating.DoesNotExist:
            return None

    def get(self, request, rating_pk):
        obj = self.get_object()
        if not obj:
            return Response({'detail': 'Rating not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(self._serialize(obj))

    def put(self, request, rating_pk):
        obj = self.get_object()
        if not obj:
            return Response({'detail': 'Rating not found'}, status=status.HTTP_404_NOT_FOUND)
        # Only rater or admin can update
        if request.user != obj.rater and request.user.role != 'admin':
            return Response({'detail': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        from .serializers import CVRatingSerializer
        serializer = CVRatingSerializer(obj, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self._serialize(obj))

    def delete(self, request, rating_pk):
        obj = self.get_object()
        if not obj:
            return Response({'detail': 'Rating not found'}, status=status.HTTP_404_NOT_FOUND)
        if request.user != obj.rater and request.user.role != 'admin':
            return Response({'detail': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _serialize(self, obj):
        from .serializers import CVRatingSerializer
        return CVRatingSerializer(obj).data


class CVRatingsListView(generics.ListAPIView):
    """List ratings for a CV. Accessible to admin, teacher, or the CV owner."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            cv = CV.objects.get(pk=pk)
        except CV.DoesNotExist:
            return Response({'detail': 'CV not found'}, status=status.HTTP_404_NOT_FOUND)
        # Allow admin/teacher, owner, or any user if CV is approved
        if request.user.role not in ['admin', 'teacher'] and request.user != cv.owner and cv.approval_status != 'approved':
            return Response({'detail': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        qs = cv.ratings.select_related('rater').all()
        from .serializers import CVRatingSerializer
        serializer = CVRatingSerializer(qs, many=True)
        return Response(serializer.data)


class ApprovedCVListView(generics.ListAPIView):
    """List approved CVs for browsing/rating."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CVSerializer

    def get_queryset(self):
        return CV.objects.select_related('owner', 'approved_by').filter(approval_status='approved')


class CVApprovalView(generics.UpdateAPIView):
    """Approve or reject a CV (admin/teacher only)."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CVSerializer
    queryset = CV.objects.select_related('owner', 'approved_by')

    def patch(self, request, pk):
        if request.user.role not in ['admin', 'teacher']:
            return Response({'detail': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        try:
            cv = CV.objects.get(pk=pk)
        except CV.DoesNotExist:
            return Response({'detail': 'CV not found'}, status=status.HTTP_404_NOT_FOUND)

        action = (request.data.get('action') or request.data.get('status') or '').lower()
        reason = (request.data.get('rejection_reason') or '').strip()

        if action in ['approve', 'approved']:
            cv.approval_status = 'approved'
            cv.approved_by = request.user
            cv.approved_at = timezone.now()
            cv.rejection_reason = ''
        elif action in ['reject', 'rejected']:
            cv.approval_status = 'rejected'
            cv.approved_by = None
            cv.approved_at = None
            cv.rejection_reason = reason
            cv.is_primary = False
        else:
            return Response({'detail': 'Invalid action. Use approve or reject.'}, status=status.HTTP_400_BAD_REQUEST)

        cv.save()
        serializer = CVSerializer(cv, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

class CVDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = CV.objects.select_related('owner').all()
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadForStaffTeacher]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return CVCreateUpdateSerializer
        return CVSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'teacher']:
            return CV.objects.select_related('owner').all()
        return CV.objects.filter(owner=user)

    def perform_update(self, serializer):
        # owner cannot be changed via update; ownership enforced
        obj = serializer.save()
        # If a student edits an approved CV, require re-approval
        if self.request.user.role == 'student' and obj.owner == self.request.user:
            if obj.approval_status == 'approved':
                obj.approval_status = 'pending'
                obj.approved_by = None
                obj.approved_at = None
                obj.rejection_reason = ''
                obj.save()


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def reset_student_password(request, pk):
    """Admin-only: generate a secure one-time password for a student and email it."""
    try:
        student = Student.objects.select_related('user').get(pk=pk)
    except Student.DoesNotExist:
        return Response({'detail': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

    # Only admin is allowed to reset and view the temporary password
    if request.user.role != 'admin':
        return Response({'detail': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    try:
        user = student.user
        if not user or not user.email:
            return Response({'detail': 'Student email is not set.'}, status=status.HTTP_400_BAD_REQUEST)

        requested_password = (request.data.get('password') or '').strip() if hasattr(request, 'data') else ''
        requested_confirm = (request.data.get('password_confirm') or '').strip() if hasattr(request, 'data') else ''
        if requested_password and requested_confirm and requested_password != requested_confirm:
            return Response({'detail': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

        if requested_password:
            if len(requested_password) < 6:
                return Response({'detail': 'Password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)
            temporary_password = requested_password
        else:
            import secrets
            temporary_password = ''.join(str(secrets.randbelow(10)) for _ in range(6))

        subject = "Your Student Account Password Reset"
        message = (
            "Your password has been reset by the administrator.\n"
            f"Your new password is: {temporary_password}\n"
            "Please log in and change your password immediately."
        )

        from django.core.mail import send_mail
        user.set_password(temporary_password)
        user.save()
        sent = send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=[user.email],
            fail_silently=False,
        )
        if sent == 0:
            return Response({'detail': 'Email not sent. Check SMTP settings.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'detail': 'Temporary password sent to student email.', 'email': user.email}, status=status.HTTP_200_OK)
    except Exception:
        logging.exception('Failed to reset student password')
        return Response({'detail': 'Internal server error while resetting password'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
