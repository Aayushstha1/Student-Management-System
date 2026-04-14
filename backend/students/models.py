from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.validators import RegexValidator
import qrcode
from io import BytesIO
from django.core.files.base import ContentFile
from PIL import Image
import uuid

User = get_user_model()


class Student(models.Model):
    """
    Student model with QR code integration
    """
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]
    
    BLOOD_GROUP_CHOICES = [
        ('A+', 'A+'),
        ('A-', 'A-'),
        ('B+', 'B+'),
        ('B-', 'B-'),
        ('AB+', 'AB+'),
        ('AB-', 'AB-'),
        ('O+', 'O+'),
        ('O-', 'O-'),
    ]
    
    # Basic Information
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    student_id = models.CharField(
        max_length=20, 
        unique=True,
        validators=[RegexValidator(r'^[A-Z0-9]+$', 'Student ID must contain only uppercase letters and numbers.')]
    )
    admission_number = models.CharField(max_length=20, unique=True)
    admission_date = models.DateField()
    
    # Personal Information
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    blood_group = models.CharField(max_length=3, choices=BLOOD_GROUP_CHOICES, blank=True, null=True)
    father_name = models.CharField(max_length=100)
    mother_name = models.CharField(max_length=100)
    guardian_contact = models.CharField(max_length=15)
    
    # Academic Information
    current_class = models.CharField(max_length=20)
    current_section = models.CharField(max_length=10)
    roll_number = models.CharField(max_length=10, blank=True, null=True)
    
    # QR Code
    qr_code = models.ImageField(upload_to='qr_codes/', blank=True, null=True)
    
    # Profile Picture
    profile_picture = models.ImageField(upload_to='student_profiles/', blank=True, null=True)
    
    # System fields
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.student_id} - {self.user.get_full_name()}"
    
    def save(self, *args, **kwargs):
        # Assign student_id if missing
        if not self.student_id:
            self.student_id = f"STU{str(uuid.uuid4())[:8].upper()}"

        # Assign admission_number if missing
        if not self.admission_number:
            self.admission_number = f"ADM{str(uuid.uuid4())[:8].upper()}"

        # Auto-assign roll_number within class+section if not provided
        if not self.roll_number:
            try:
                qs = Student.objects.filter(current_class=self.current_class, current_section=self.current_section)
                if self.pk:
                    qs = qs.exclude(pk=self.pk)
                max_roll = 0
                for s in qs.exclude(roll_number__isnull=True).exclude(roll_number=''):
                    try:
                        r = int(s.roll_number)
                    except Exception:
                        continue
                    if r > max_roll:
                        max_roll = r
                self.roll_number = str(max_roll + 1)
            except Exception:
                # If anything goes wrong, fall back to '1'
                self.roll_number = '1'

        # Generate QR code if not exists
        if not self.qr_code:
            self.generate_qr_code()

        super().save(*args, **kwargs)
    
    def _build_profile_url(self, base_url=None):
        base = (base_url or getattr(settings, 'FRONTEND_URL', '') or '').strip()
        if not base:
            return None
        return f"{base.rstrip('/')}/public/student/{self.student_id}"

    def generate_qr_code(self, base_url=None, payload=None):
        """
        Generate QR code for the student.
        Payload defaults to the public profile URL for scannability.
        """
        if payload:
            qr_payload = str(payload)
        else:
            qr_payload = self._build_profile_url(base_url) or self.student_id

        # Create QR code (auto-fit size for larger payloads)
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )

        try:
            qr.add_data(qr_payload)
            qr.make(fit=True)
        except Exception:
            # Fallback to minimal payload if too large
            qr = qrcode.QRCode(
                version=None,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(self.student_id)
            qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Save to BytesIO
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        # Save to model
        filename = f"qr_{self.student_id}.png"
        self.qr_code.save(filename, ContentFile(buffer.getvalue()), save=False)
    
    def get_qr_code_data(self):
        """
        Return QR code data as dictionary, including borrowed books, recent results,
        and key operational summaries (hostel, library).
        """
        qr_url = None
        try:
            if self.qr_code:
                qr_url = self.qr_code.url
                if qr_url and self.updated_at:
                    sep = '&' if '?' in qr_url else '?'
                    qr_url = f"{qr_url}{sep}v={int(self.updated_at.timestamp())}"
        except Exception:
            qr_url = None

        data = {
            'student_id': self.student_id,
            'name': self.user.get_full_name(),
            'class': self.current_class,
            'section': self.current_section,
            'roll_number': self.roll_number,
            'admission_number': self.admission_number,
            'father_name': self.father_name,
            'mother_name': self.mother_name,
            'guardian_contact': self.guardian_contact,
            'qr_code_url': qr_url,
        }

        # Profile URL for scanning
        try:
            from django.conf import settings
            data['profile_url'] = f"{getattr(settings, 'FRONTEND_URL', '').rstrip('/')}" + f"/public/student/{self.student_id}"
        except Exception:
            data['profile_url'] = None

        # Add borrowed books (current issues)
        try:
            from library.models import BookIssue
            issues = BookIssue.objects.filter(student=self, status='issued').select_related('book')
            data['borrowed_books'] = [
                {
                    'book_id': i.book.id,
                    'title': i.book.title,
                    'issued_date': i.issued_date.isoformat() if i.issued_date else None,
                    'status': i.status,
                }
                for i in issues
            ]
        except Exception:
            data['borrowed_books'] = []

        # Parent/guardian details
        try:
            parents = []
            for profile in self.parent_profiles.select_related('user').all():
                user = profile.user
                parents.append({
                    'relation': profile.relation,
                    'name': user.get_full_name() or user.username,
                    'email': user.email,
                    'phone': getattr(user, 'phone', None),
                    'username': user.username,
                })
            data['parents'] = parents
        except Exception:
            data['parents'] = []

        # Attendance summary (all-time + last 30 days)
        try:
            from attendance.models import Attendance
            from django.utils import timezone
            from datetime import timedelta
            qs = Attendance.objects.filter(student=self)
            total = qs.count()
            present = qs.filter(status='present').count()
            late = qs.filter(status='late').count()
            absent = qs.filter(status='absent').count()
            excused = qs.filter(status='excused').count()

            since = timezone.now().date() - timedelta(days=30)
            qs30 = qs.filter(date__gte=since)
            total30 = qs30.count()
            present30 = qs30.filter(status='present').count()
            late30 = qs30.filter(status='late').count()
            absent30 = qs30.filter(status='absent').count()
            excused30 = qs30.filter(status='excused').count()

            data['attendance'] = {
                'total': total,
                'present': present,
                'late': late,
                'absent': absent,
                'excused': excused,
                'last_30_days': {
                    'total': total30,
                    'present': present30,
                    'late': late30,
                    'absent': absent30,
                    'excused': excused30,
                },
            }
        except Exception:
            data['attendance'] = None

        # Hostel summary
        try:
            from hostel.models import HostelAllocation, HostelFeeRecord
            allocation = HostelAllocation.objects.filter(student=self, is_active=True).select_related('room__hostel').first()
            if allocation and allocation.room:
                data['hostel'] = {
                    'hostel_name': allocation.room.hostel.name if allocation.room.hostel else None,
                    'room_number': allocation.room.room_number,
                    'room_type': allocation.room.room_type,
                    'monthly_rent': str(allocation.monthly_rent),
                    'allocated_date': allocation.allocated_date.isoformat() if allocation.allocated_date else None,
                    'is_active': allocation.is_active,
                }
            else:
                data['hostel'] = None

            hostel_fees = HostelFeeRecord.objects.filter(student=self)
            pending_fees = hostel_fees.filter(status__in=['pending', 'overdue'])
            data['hostel_fees'] = {
                'pending_count': pending_fees.count(),
                'pending_total': str(pending_fees.aggregate(models.Sum('amount')).get('amount__sum') or 0),
                'last_due_date': pending_fees.order_by('-due_date').first().due_date.isoformat() if pending_fees.exists() else None,
            }
        except Exception:
            data['hostel'] = None
            data['hostel_fees'] = {'pending_count': 0, 'pending_total': '0', 'last_due_date': None}

        # Add recent published results
        try:
            from results.models import Result
            recent_results = self.results.filter(status='published').select_related('exam').order_by('-published_at')[:5]
            data['recent_results'] = []
            for r in recent_results:
                passed = r.marks_obtained >= r.exam.passing_marks if r.exam and r.exam.passing_marks is not None else (r.grade is not None and r.grade != 'F')
                data['recent_results'].append({
                    'exam': r.exam.name if r.exam else None,
                    'marks_obtained': r.marks_obtained,
                    'total_marks': r.exam.total_marks if r.exam else None,
                    'grade': r.grade,
                    'status': r.status,
                    'passed': passed,
                })
        except Exception:
            data['recent_results'] = []

        return data
    
    class Meta:
        ordering = ['student_id']
        verbose_name = 'Student'
        verbose_name_plural = 'Students'
        constraints = [
            models.UniqueConstraint(fields=['current_class', 'current_section', 'roll_number'], name='unique_roll_per_section')
        ]


class ClassSection(models.Model):
    """Represent a class and section combination (e.g., Class=12, Section=A)."""
    class_name = models.CharField(max_length=20)
    section = models.CharField(max_length=10, blank=True, null=True)

    class Meta:
        unique_together = ('class_name', 'section')
        ordering = ['class_name', 'section']

    def __str__(self):
        return f"{self.class_name}{(' ' + self.section) if self.section else ''}"


class StudentPasswordResetRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    student = models.ForeignKey(
        Student,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='password_reset_requests',
    )
    username = models.CharField(max_length=150)
    class_name = models.CharField(max_length=20)
    father_name = models.CharField(max_length=100)
    email = models.EmailField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_password_reset_requests',
    )
    note = models.TextField(blank=True)

    class Meta:
        ordering = ['-requested_at']

    def __str__(self):
        return f"{self.username} - {self.status}"


class StudentEmailChangeRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='email_change_requests',
    )
    new_email = models.EmailField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_email_change_requests',
    )
    note = models.TextField(blank=True)

    class Meta:
        ordering = ['-requested_at']

    def __str__(self):
        return f"{self.student.student_id} - {self.new_email} ({self.status})"


class ConsentRequest(models.Model):
    TYPE_CHOICES = [
        ('trip', 'Field Trip'),
        ('hostel_leave', 'Hostel Leave'),
        ('medical', 'Medical'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='consent_requests')
    request_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=150)
    details = models.TextField(blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='consent_requests_submitted',
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='consent_requests_reviewed',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    # Trip-specific fields (used when request_type == 'trip')
    location = models.CharField(max_length=200, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    event_id = models.UUIDField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.student.student_id} - {self.title} ({self.status})"

# Import CV model kept in a separate module to keep students/models.py focused
from .cv import CV
