from datetime import date

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from attendance.models import Subject
from results.models import Exam, ExamRoom, ExamSeatAssignment
from students.models import Student

User = get_user_model()


def normalize_api_list(data):
    if isinstance(data, list):
        return data
    return data.get('results', [])


class SeatPlanningApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin-seat',
            password='pass1234',
            role='admin',
            first_name='Admin',
            last_name='User',
        )
        self.subject = Subject.objects.create(name='Mathematics', code='MATH-01')
        self.exam = Exam.objects.create(
            name='Mathematics - Mid Term',
            exam_type='mid_term',
            subject=self.subject,
            class_name='10',
            section='A',
            total_marks=100,
            passing_marks=40,
            exam_date=date(2026, 5, 10),
            is_active=True,
        )
        self.room_a = ExamRoom.objects.create(
            name='Hall A',
            building='Main Block',
            rows=1,
            columns=2,
            capacity=2,
            is_active=True,
        )
        self.room_b = ExamRoom.objects.create(
            name='Hall B',
            building='Main Block',
            rows=1,
            columns=2,
            capacity=2,
            is_active=True,
        )
        self.students = [
            self._create_student('seatstu1', 'STU1001', 'ADM1001', '1'),
            self._create_student('seatstu2', 'STU1002', 'ADM1002', '2'),
            self._create_student('seatstu3', 'STU1003', 'ADM1003', '3'),
        ]

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
            current_class='10',
            current_section='A',
            roll_number=roll_number,
        )

    def test_admin_can_generate_balanced_seat_plan(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            '/api/results/seat-plans/generate/',
            {
                'exam': self.exam.id,
                'room_ids': [self.room_a.id, self.room_b.id],
                'distribution': 'balanced',
                'pattern': 'row_wise',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 3)
        self.assertEqual(ExamSeatAssignment.objects.filter(exam=self.exam).count(), 3)

        room_a_count = ExamSeatAssignment.objects.filter(exam=self.exam, room=self.room_a).count()
        room_b_count = ExamSeatAssignment.objects.filter(exam=self.exam, room=self.room_b).count()
        self.assertEqual(room_a_count, 2)
        self.assertEqual(room_b_count, 1)

    def test_student_exam_list_includes_my_seat_assignment(self):
        ExamSeatAssignment.objects.create(
            exam=self.exam,
            student=self.students[0],
            room=self.room_a,
            seat_number=1,
            seat_label='A1',
            row_number=1,
            column_number=1,
            assigned_by=self.admin,
        )

        self.client.force_authenticate(user=self.students[0].user)
        response = self.client.get('/api/results/exams/')
        results = normalize_api_list(response.data)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(results), 1)
        seat_assignment = results[0]['my_seat_assignment']
        self.assertIsNotNone(seat_assignment)
        self.assertEqual(seat_assignment['room_name'], 'Hall A')
        self.assertEqual(seat_assignment['seat_label'], 'A1')

    def test_student_seat_assignments_endpoint_returns_only_own_record(self):
        ExamSeatAssignment.objects.create(
            exam=self.exam,
            student=self.students[0],
            room=self.room_a,
            seat_number=1,
            seat_label='A1',
            row_number=1,
            column_number=1,
            assigned_by=self.admin,
        )
        ExamSeatAssignment.objects.create(
            exam=self.exam,
            student=self.students[1],
            room=self.room_b,
            seat_number=1,
            seat_label='A1',
            row_number=1,
            column_number=1,
            assigned_by=self.admin,
        )

        self.client.force_authenticate(user=self.students[0].user)
        response = self.client.get('/api/results/seat-assignments/')
        results = normalize_api_list(response.data)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['student_id'], self.students[0].student_id)
