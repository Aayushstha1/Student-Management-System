from datetime import date, datetime, time
import os
import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from attendance.models import Attendance, AttendanceSession, Subject
from notices.models import Notice, NoticeCategory, NoticeRead
from results.models import ClassSubjectAssignment, Exam, ExamRoom, ExamSeatAssignment, Result
from service_requests.models import ServiceRequest
from students.models import ConsentRequest, Student
from tasks.models import Task, TaskSubmission
from teachers.models import Teacher

User = get_user_model()


class ExamDayCommandCenterTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        parent_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'test_media')
        os.makedirs(parent_dir, exist_ok=True)
        cls._temp_media_root = tempfile.mkdtemp(dir=parent_dir)
        cls._override = override_settings(MEDIA_ROOT=cls._temp_media_root)
        cls._override.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._override.disable()
        shutil.rmtree(cls._temp_media_root, ignore_errors=True)

    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin-command',
            password='pass1234',
            role='admin',
            first_name='Admin',
            last_name='Command',
        )
        self.teacher_user = User.objects.create_user(
            username='teacher-command',
            password='pass1234',
            role='teacher',
            first_name='Tara',
            last_name='Teacher',
        )
        self.teacher = Teacher.objects.create(
            user=self.teacher_user,
            employee_id='TCHCMD1',
            joining_date=date(2024, 1, 1),
            qualification='M.Sc',
            department='Science',
            designation='Senior Teacher',
            experience_years=6,
            is_active=True,
        )
        self.subject = Subject.objects.create(name='Physics', code='PHY-01')
        self.exam = Exam.objects.create(
            name='Physics - Mid Term',
            exam_type='mid_term',
            subject=self.subject,
            class_name='12',
            section='A',
            total_marks=100,
            passing_marks=40,
            exam_date=date(2026, 5, 3),
            start_time=time(10, 0),
            end_time=time(12, 0),
            is_active=True,
        )
        ClassSubjectAssignment.objects.create(
            class_name='12',
            section='A',
            subject=self.subject,
            teacher=self.teacher,
            is_active=True,
        )
        self.room = ExamRoom.objects.create(
            name='Block A-101',
            building='Academic Block A',
            rows=1,
            columns=2,
            capacity=2,
            is_active=True,
        )
        self.students = [
            self._create_student('cmdstudent1', 'STUCMD01', 'ADM-CMD-1', '1'),
            self._create_student('cmdstudent2', 'STUCMD02', 'ADM-CMD-2', '2'),
        ]
        for seat_number, student in enumerate(self.students, start=1):
            ExamSeatAssignment.objects.create(
                exam=self.exam,
                student=student,
                room=self.room,
                seat_number=seat_number,
                seat_label=f'A{seat_number}',
                row_number=1,
                column_number=seat_number,
                assigned_by=self.admin,
            )

        self.session = AttendanceSession.objects.create(
            subject=self.subject,
            date=date(2026, 5, 3),
            period=1,
            class_name='12',
            section='A',
            teacher=self.teacher,
            created_by=self.admin,
        )
        Attendance.objects.create(
            session=self.session,
            student=self.students[0],
            subject=self.subject,
            teacher=self.teacher,
            date=date(2026, 5, 3),
            status='present',
            marked_by=self.admin,
        )
        Attendance.objects.create(
            session=self.session,
            student=self.students[1],
            subject=self.subject,
            teacher=self.teacher,
            date=date(2026, 5, 3),
            status='absent',
            marked_by=self.admin,
        )
        self.category = NoticeCategory.objects.create(name='Exam', description='Exam notices')
        self.notice = Notice.objects.create(
            title='Exam Instructions',
            content='Bring your admit card.',
            category=self.category,
            priority='high',
            target_audience='students',
            published_by=self.admin,
            is_active=True,
        )
        NoticeRead.objects.create(notice=self.notice, user=self.students[0].user)
        self.task = Task.objects.create(
            title='Wave Revision Sheet',
            description='Complete the worksheet.',
            assigned_by=self.admin,
            assigned_to_class='12',
            assigned_to_section='A',
            due_date=datetime.combine(date(2026, 5, 2), time(17, 0), tzinfo=timezone.get_current_timezone()),
            status='closed',
            total_marks=20,
        )
        TaskSubmission.objects.create(
            task=self.task,
            student=self.students[0],
            submission_file='task_submissions/test.txt',
            submitted_at=datetime.combine(date(2026, 5, 2), time(16, 0), tzinfo=timezone.get_current_timezone()),
            score=16,
            status='graded',
        )
        Result.objects.create(
            student=self.students[0],
            exam=self.exam,
            marks_obtained=72,
            status='approved',
            published_by=self.admin,
            approved_by=self.admin,
        )
        Result.objects.create(
            student=self.students[1],
            exam=self.exam,
            marks_obtained=28,
            status='approved',
            published_by=self.admin,
            approved_by=self.admin,
        )
        ServiceRequest.objects.create(
            student=self.students[1],
            request_type='other',
            title='Need counseling meeting',
            status='pending',
            assigned_role='admin',
        )
        ConsentRequest.objects.create(
            student=self.students[1],
            request_type='other',
            title='Science fair approval',
            status='pending',
            submitted_by=self.admin,
        )

    def _create_student(self, username, student_id, admission_number, roll_number):
        user = User.objects.create_user(
            username=username,
            password='pass1234',
            role='student',
            first_name=username.upper(),
            last_name='Test',
        )
        return Student.objects.create(
            user=user,
            student_id=student_id,
            admission_number=admission_number,
            admission_date=date(2026, 1, 1),
            date_of_birth=date(2010, 1, 1),
            gender='M',
            father_name='Father Test',
            mother_name='Mother Test',
            guardian_contact='9800000000',
            current_class='12',
            current_section='A',
            roll_number=roll_number,
        )

    def test_admin_can_fetch_exam_day_command_center(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get('/api/accounts/exam-day-command-center/?date=2026-05-03')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['metrics']['total_exams'], 1)
        self.assertEqual(response.data['metrics']['assigned_seats'], 2)
        self.assertEqual(response.data['metrics']['rooms_in_use'], 1)
        self.assertEqual(response.data['metrics']['attendance_sessions_ready'], 1)
        self.assertEqual(response.data['metrics']['attendance_complete'], 1)

        self.assertEqual(len(response.data['exams']), 1)
        exam_payload = response.data['exams'][0]
        self.assertEqual(exam_payload['subject_name'], 'Physics')
        self.assertEqual(exam_payload['attendance']['status'], 'complete')
        self.assertEqual(exam_payload['rooms'][0]['room_name'], 'Block A-101')
        self.assertEqual(exam_payload['rooms'][0]['suggested_invigilator']['employee_id'], 'TCHCMD1')

        self.assertEqual(len(response.data['rooms']), 1)
        self.assertEqual(response.data['rooms'][0]['occupancy_percent'], 100.0)

    def test_non_admin_cannot_fetch_exam_day_command_center(self):
        self.client.force_authenticate(user=self.teacher_user)

        response = self.client.get('/api/accounts/exam-day-command-center/?date=2026-05-03')

        self.assertEqual(response.status_code, 403)

    def test_admin_can_fetch_admin_intelligence(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get('/api/accounts/admin-intelligence/')

        self.assertEqual(response.status_code, 200)
        self.assertIn('student_360', response.data)
        self.assertIn('intervention_planner', response.data)
        self.assertIn('exam_readiness', response.data)
        self.assertIn('homework_result_analyzer', response.data)
        self.assertIn('academic_health', response.data)

        self.assertGreaterEqual(len(response.data['student_360']['students']), 1)
        self.assertGreaterEqual(len(response.data['intervention_planner']['plans']), 1)
        self.assertGreaterEqual(len(response.data['exam_readiness']['exams']), 1)
        self.assertGreaterEqual(len(response.data['homework_result_analyzer']['classes']), 1)
        self.assertGreaterEqual(len(response.data['academic_health']['classes']), 1)

    def test_non_admin_cannot_fetch_admin_intelligence(self):
        self.client.force_authenticate(user=self.teacher_user)

        response = self.client.get('/api/accounts/admin-intelligence/')

        self.assertEqual(response.status_code, 403)
