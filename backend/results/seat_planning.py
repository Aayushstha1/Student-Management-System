import re

from django.db import transaction

from parents.utils import get_student_for_user
from students.models import Student

from .models import ExamSeatAssignment


def _row_label(row_number):
    label = ''
    current = int(row_number or 0)
    while current > 0:
        current, remainder = divmod(current - 1, 26)
        label = chr(65 + remainder) + label
    return label or 'A'


def _roll_sort_key(student):
    raw = str(student.roll_number or '').strip()
    match = re.search(r'\d+', raw)
    numeric = int(match.group()) if match else 10**9
    return (
        str(student.current_section or '').upper(),
        numeric,
        raw.lower(),
        str(student.student_id or ''),
    )


def get_exam_candidates(exam):
    queryset = Student.objects.filter(current_class=exam.class_name, is_active=True).select_related('user')
    if exam.section:
        queryset = queryset.filter(current_section=exam.section)
    students = list(queryset)
    students.sort(key=_roll_sort_key)
    return students


def build_room_seats(room, pattern='row_wise'):
    coordinates = []
    for row_number in range(1, room.rows + 1):
        columns = list(range(1, room.columns + 1))
        if pattern == 'serpentine' and row_number % 2 == 0:
            columns.reverse()
        for column_number in columns:
            coordinates.append({
                'row_number': row_number,
                'column_number': column_number,
                'seat_label': f"{_row_label(row_number)}{column_number}",
            })

    if pattern == 'checkerboard':
        preferred = [
            item for item in coordinates if (item['row_number'] + item['column_number']) % 2 == 0
        ]
        coordinates = preferred

    return coordinates[:room.capacity]


def build_seat_order(room_configs, distribution='balanced'):
    if distribution == 'room_fill':
        ordered = []
        for config in room_configs:
            for index, seat in enumerate(config['seats'], start=1):
                ordered.append((config['room'], seat, index))
        return ordered

    ordered = []
    longest = max((len(config['seats']) for config in room_configs), default=0)
    for seat_index in range(longest):
        for config in room_configs:
            if seat_index < len(config['seats']):
                ordered.append((config['room'], config['seats'][seat_index], seat_index + 1))
    return ordered


def build_seat_plan_summary(exam):
    assignments = exam.seat_assignments.select_related('room')
    expected_count = exam.candidate_count()
    assigned_count = assignments.count()
    room_names = sorted({assignment.room.name for assignment in assignments})
    return {
        'expected_count': expected_count,
        'assigned_count': assigned_count,
        'room_count': len(room_names),
        'room_names': room_names,
        'is_complete': expected_count > 0 and assigned_count >= expected_count,
    }


def build_user_seat_assignment(exam, user):
    student = get_student_for_user(user)
    if not student:
        return None
    assignment = exam.seat_assignments.select_related('room').filter(student=student).first()
    if not assignment:
        return None
    return {
        'room_id': assignment.room_id,
        'room_name': assignment.room.name,
        'seat_number': assignment.seat_number,
        'seat_label': assignment.seat_label,
        'row_number': assignment.row_number,
        'column_number': assignment.column_number,
    }


def generate_seat_plan(
    *,
    exam,
    rooms,
    distribution='balanced',
    pattern='row_wise',
    assigned_by=None,
    replace_existing=True,
):
    if not rooms:
        raise ValueError('Select at least one exam room.')

    students = get_exam_candidates(exam)
    if not students:
        raise ValueError('No active students found for this exam.')

    room_configs = []
    for room in rooms:
        seats = build_room_seats(room, pattern=pattern)
        if seats:
            room_configs.append({'room': room, 'seats': seats})

    available_count = sum(len(config['seats']) for config in room_configs)
    if available_count < len(students):
        raise ValueError(
            f'Not enough seats. Need {len(students)} seats but only {available_count} are available.'
        )

    seat_order = build_seat_order(room_configs, distribution=distribution)
    if len(seat_order) < len(students):
        raise ValueError('Seat layout could not fit all students with the selected pattern.')

    assignments = []
    for student, (room, seat, seat_number) in zip(students, seat_order):
        assignments.append(
            ExamSeatAssignment(
                exam=exam,
                student=student,
                room=room,
                seat_number=seat_number,
                seat_label=seat['seat_label'],
                row_number=seat['row_number'],
                column_number=seat['column_number'],
                assigned_by=assigned_by,
            )
        )

    with transaction.atomic():
        if replace_existing:
            ExamSeatAssignment.objects.filter(exam=exam).delete()
        elif ExamSeatAssignment.objects.filter(exam=exam).exists():
            raise ValueError('Seat assignments already exist for this exam.')
        ExamSeatAssignment.objects.bulk_create(assignments)

    return assignments
