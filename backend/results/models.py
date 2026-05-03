from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from attendance.models import Subject
from students.models import Student
from teachers.models import Teacher


class Exam(models.Model):
    """
    Exam model for managing different types of exams
    """
    EXAM_TYPES = [
        ('unit_test', 'Unit Test'),
        ('mid_term', 'Mid Term'),
        ('final', 'Final Exam'),
        ('pre_board', 'Pre-Board'),
        ('practical', 'Practical'),
        ('assignment', 'Assignment'),
        ('project', 'Project'),
    ]
    
    name = models.CharField(max_length=100)
    exam_type = models.CharField(max_length=20, choices=EXAM_TYPES)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='exams')
    class_name = models.CharField(max_length=20, blank=True, default='')
    section = models.CharField(max_length=10, blank=True, default='')
    topic = models.CharField(max_length=120, blank=True)
    total_marks = models.PositiveIntegerField()
    passing_marks = models.PositiveIntegerField()
    exam_date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def candidate_students(self):
        queryset = Student.objects.filter(current_class=self.class_name, is_active=True)
        if self.section:
            queryset = queryset.filter(current_section=self.section)
        return queryset.select_related('user')

    def candidate_count(self):
        return self.candidate_students().count()
    
    def __str__(self):
        class_part = f"{self.class_name}{(' ' + self.section) if self.section else ''}".strip()
        class_label = f"Class {class_part} - " if class_part else ""
        return f"{class_label}{self.name} - {self.subject.name}"
    
    class Meta:
        ordering = ['-exam_date']


class Result(models.Model):
    """
    Result model for managing student exam results with approval workflow
    """
    GRADE_CHOICES = [
        ('A+', 'A+'),
        ('A', 'A'),
        ('B+', 'B+'),
        ('B', 'B'),
        ('C+', 'C+'),
        ('C', 'C'),
        ('D', 'D'),
        ('F', 'F'),
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('pending_approval', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='results')
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='results')
    marks_obtained = models.PositiveIntegerField()
    grade = models.CharField(max_length=2, choices=GRADE_CHOICES, blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='published_results')
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_results')
    approval_remarks = models.TextField(blank=True, null=True)
    published_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.student.student_id} - {self.exam.name} - {self.marks_obtained}"
    
    def calculate_grade(self):
        percentage = (self.marks_obtained / self.exam.total_marks) * 100
        
        if percentage >= 90:
            return 'A+'
        elif percentage >= 80:
            return 'A'
        elif percentage >= 70:
            return 'B+'
        elif percentage >= 60:
            return 'B'
        elif percentage >= 50:
            return 'C+'
        elif percentage >= 40:
            return 'C'
        elif percentage >= self.exam.passing_marks:
            return 'D'
        else:
            return 'F'
    
    def save(self, *args, **kwargs):
        self.grade = self.calculate_grade()
        super().save(*args, **kwargs)
    
    class Meta:
        unique_together = ['student', 'exam']
        ordering = ['-created_at']


class AcademicYear(models.Model):
    """
    Academic Year model for managing academic sessions
    """
    name = models.CharField(max_length=20, unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        if self.is_current:
            # Set all other academic years to not current
            AcademicYear.objects.filter(is_current=True).update(is_current=False)
        super().save(*args, **kwargs)
    
    class Meta:
        ordering = ['-start_date']


class Semester(models.Model):
    """
    Semester model for managing semesters within academic years
    """
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name='semesters')
    name = models.CharField(max_length=50)
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.academic_year.name} - {self.name}"
    
    def save(self, *args, **kwargs):
        if self.is_current:
            # Set all other semesters to not current
            Semester.objects.filter(is_current=True).update(is_current=False)
        super().save(*args, **kwargs)
    
    class Meta:
        unique_together = ['academic_year', 'name']
        ordering = ['academic_year', 'name']


class ClassSubjectAssignment(models.Model):
    """
    Fixed subject-teacher mapping per class/section.
    """
    class_name = models.CharField(max_length=20)
    section = models.CharField(max_length=10, blank=True, default='')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='class_subject_assignments')
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name='class_subject_assignments')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        section_part = f" {self.section}" if self.section else ""
        teacher_part = self.teacher.user.get_full_name() if self.teacher else "Unassigned"
        return f"Class {self.class_name}{section_part} - {self.subject.name} ({teacher_part})"

    class Meta:
        unique_together = ['class_name', 'section', 'subject']
        ordering = ['class_name', 'section', 'subject__name']


class ExamRoom(models.Model):
    name = models.CharField(max_length=100, unique=True)
    building = models.CharField(max_length=120, blank=True)
    rows = models.PositiveIntegerField(default=5)
    columns = models.PositiveIntegerField(default=6)
    capacity = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def grid_capacity(self):
        return self.rows * self.columns

    def clean(self):
        if self.rows <= 0:
            raise ValidationError({'rows': 'Rows must be greater than zero.'})
        if self.columns <= 0:
            raise ValidationError({'columns': 'Columns must be greater than zero.'})
        if self.capacity <= 0:
            raise ValidationError({'capacity': 'Capacity must be greater than zero.'})
        if self.capacity > self.grid_capacity:
            raise ValidationError({'capacity': 'Capacity cannot be greater than rows x columns.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


class ExamSeatAssignment(models.Model):
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='seat_assignments')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='exam_seat_assignments')
    room = models.ForeignKey(ExamRoom, on_delete=models.CASCADE, related_name='seat_assignments')
    seat_number = models.PositiveIntegerField()
    seat_label = models.CharField(max_length=20)
    row_number = models.PositiveIntegerField()
    column_number = models.PositiveIntegerField()
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='exam_seat_assignments',
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.exam.name} - {self.student.student_id} - {self.room.name} {self.seat_label}"

    class Meta:
        ordering = ['room__name', 'seat_number', 'student__student_id']
        constraints = [
            models.UniqueConstraint(fields=['exam', 'student'], name='unique_exam_student_seat_assignment'),
            models.UniqueConstraint(fields=['exam', 'room', 'seat_number'], name='unique_exam_room_seat_number'),
            models.UniqueConstraint(fields=['exam', 'room', 'seat_label'], name='unique_exam_room_seat_label'),
            models.UniqueConstraint(fields=['exam', 'room', 'row_number', 'column_number'], name='unique_exam_room_position'),
        ]
