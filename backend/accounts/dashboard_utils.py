from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.utils import timezone

from attendance.models import Attendance, AttendanceSession, LeaveRequest
from hostel.models import HostelLeaveRequest, HostelMaintenanceRequest, HostelRoomRequest
from library.models import BookIssue
from notices.analytics import build_notice_analytics
from notices.models import UserNotification
from results.conflicts import collect_exam_conflicts, resolve_exam_teacher, time_ranges_overlap
from results.models import Exam, Result
from service_requests.models import ServiceRequest
from students.models import ConsentRequest, Student, StudentEmailChangeRequest, StudentPasswordResetRequest
from teachers.models import Teacher
from timetable.conflicts import collect_schedule_conflicts

User = get_user_model()


def _teacher_payload(teacher):
    if not teacher:
        return None
    display_name = teacher.user.get_full_name() if teacher.user else ''
    return {
        'id': teacher.id,
        'employee_id': teacher.employee_id,
        'name': display_name or (teacher.user.username if teacher.user else teacher.employee_id),
        'department': teacher.department,
        'designation': teacher.designation,
    }


def _class_section_key(class_name, section=''):
    return f"{str(class_name or '').strip().lower()}::{str(section or '').strip().lower()}"


def _role_counts():
    return {
        'total_students': User.objects.filter(role='student').count(),
        'total_teachers': User.objects.filter(role='teacher').count(),
        'total_users': User.objects.count(),
        'active_students': User.objects.filter(role='student', is_active=True).count(),
        'active_teachers': User.objects.filter(role='teacher', is_active=True).count(),
    }


def _pending_work():
    return {
        'pending_results': Result.objects.filter(status='pending_approval').count(),
        'pending_consents': ConsentRequest.objects.filter(status='pending').count(),
        'pending_service_requests': ServiceRequest.objects.filter(status__in=['pending', 'in_progress']).count(),
        'pending_leave_requests': LeaveRequest.objects.filter(status='pending').count(),
        'pending_hostel_leaves': HostelLeaveRequest.objects.filter(status__in=['pending_warden', 'pending_parent']).count(),
        'pending_room_requests': HostelRoomRequest.objects.filter(status='pending').count(),
        'pending_maintenance': HostelMaintenanceRequest.objects.filter(status__in=['pending', 'in_progress']).count(),
        'password_reset_requests': StudentPasswordResetRequest.objects.filter(status='pending').count(),
        'email_change_requests': StudentEmailChangeRequest.objects.filter(status='pending').count(),
    }


def _risk_snapshot():
    attendance_rows = Attendance.objects.values('student_id').annotate(
        total=Count('id'),
        present=Count('id', filter=Q(status__in=['present', 'late', 'excused'])),
    )

    low_attendance_students = []
    for row in attendance_rows:
        total = row['total'] or 0
        if total == 0:
            continue
        percentage = (row['present'] / total) * 100
        if percentage < 75:
            low_attendance_students.append({'student_id': row['student_id'], 'attendance_percentage': round(percentage, 2)})

    low_attendance_ids = [row['student_id'] for row in low_attendance_students[:5]]
    student_names = {
        item.id: f"{item.user.get_full_name() or item.student_id} ({item.current_class} {item.current_section})".strip()
        for item in Student.objects.select_related('user').filter(id__in=low_attendance_ids)
    }

    for row in low_attendance_students[:5]:
        row['student_name'] = student_names.get(row['student_id'], f"Student {row['student_id']}")

    overdue_books = BookIssue.objects.filter(status__in=['issued', 'overdue'], due_date__lt=timezone.localdate()).count()
    pending_requests = _pending_work()

    return {
        'low_attendance_count': len(low_attendance_students),
        'low_attendance_students': low_attendance_students[:5],
        'overdue_books': overdue_books,
        'pending_requests_total': sum(pending_requests.values()),
    }


def _recent_activity(limit=10):
    items = []

    from notices.models import Notice
    from results.models import Result

    for notice in Notice.objects.select_related('published_by').order_by('-published_at')[:4]:
        items.append({
            'type': 'notice',
            'title': notice.title,
            'subtitle': f"Notice published for {notice.target_audience}",
            'status': notice.priority,
            'time': notice.published_at.isoformat() if notice.published_at else None,
            'link': '/admin/notices',
        })

    for result in Result.objects.select_related('student__user', 'exam').exclude(status='draft').order_by('-updated_at')[:4]:
        items.append({
            'type': 'result',
            'title': f"{result.exam.name if result.exam else 'Exam'} - {result.student.user.get_full_name() if result.student and result.student.user else result.student_id}",
            'subtitle': f"Result {result.status.replace('_', ' ')}",
            'status': result.status,
            'time': result.updated_at.isoformat() if result.updated_at else None,
            'link': '/admin/results',
        })

    for request in ServiceRequest.objects.select_related('student__user', 'handled_by').order_by('-updated_at')[:4]:
        items.append({
            'type': 'service_request',
            'title': request.title,
            'subtitle': f"{request.student.user.get_full_name() if request.student and request.student.user else request.student_id} - {request.get_status_display()}",
            'status': request.status,
            'time': request.updated_at.isoformat() if request.updated_at else None,
            'link': '/admin/requests',
        })

    items.sort(key=lambda item: item.get('time') or '', reverse=True)
    return items[:limit]


def _document_snapshot():
    approved_result_students = Result.objects.filter(status='approved').values('student_id').distinct().count()
    upcoming_exams = Result.objects.none()
    try:
        from results.models import Exam

        upcoming_exams = Exam.objects.filter(exam_date__gte=timezone.localdate(), is_active=True).count()
    except Exception:
        upcoming_exams = 0

    return {
        'students_with_report_cards': approved_result_students,
        'upcoming_exam_circulars': upcoming_exams,
        'active_notices': build_notice_analytics()['summary']['active_notices'],
    }


def build_exam_day_command_center(selected_date=None):
    target_date = selected_date or timezone.localdate()
    exams = list(
        Exam.objects.filter(exam_date=target_date, is_active=True)
        .select_related('subject')
        .prefetch_related('seat_assignments__room')
        .order_by('start_time', 'class_name', 'section', 'name')
    )
    active_teachers = list(
        Teacher.objects.filter(is_active=True)
        .select_related('user')
        .order_by('user__first_name', 'user__last_name', 'employee_id')
    )
    attendance_sessions = list(
        AttendanceSession.objects.filter(date=target_date, period=1)
        .select_related('subject', 'teacher')
        .prefetch_related('attendances')
    )

    sessions_by_class = {}
    for session in attendance_sessions:
        key = _class_section_key(session.class_name, session.section)
        sessions_by_class.setdefault(key, []).append(session)

    room_usage = {}
    invigilator_roster = []
    scheduled_invigilators = []
    exam_rows = []
    alerts = []

    total_expected_students = 0
    total_assigned_seats = 0
    total_rooms_in_use = 0
    attendance_sessions_ready = 0
    attendance_complete = 0
    total_invigilator_slots = 0
    suggested_invigilators = 0

    for exam in exams:
        expected_students = exam.candidate_count()
        total_expected_students += expected_students

        assignments = list(
            exam.seat_assignments.select_related('room', 'student__user').order_by('room__name', 'seat_number')
        )
        total_assigned_seats += len(assignments)

        rooms_for_exam = {}
        for assignment in assignments:
            room_entry = rooms_for_exam.setdefault(
                assignment.room_id,
                {
                    'room_id': assignment.room_id,
                    'room_name': assignment.room.name,
                    'building': assignment.room.building,
                    'capacity': assignment.room.capacity,
                    'rows': assignment.room.rows,
                    'columns': assignment.room.columns,
                    'assigned_students': 0,
                    'seat_labels_preview': [],
                    'suggested_invigilator': None,
                },
            )
            room_entry['assigned_students'] += 1
            if len(room_entry['seat_labels_preview']) < 4:
                room_entry['seat_labels_preview'].append(assignment.seat_label)

        subject_teacher = None
        try:
            subject_teacher = resolve_exam_teacher(exam.class_name, exam.section, exam.subject_id)
        except Exception:
            subject_teacher = None

        teacher_pool = [teacher for teacher in active_teachers if teacher.id != getattr(subject_teacher, 'id', None)]
        if subject_teacher:
            teacher_pool.append(subject_teacher)

        room_entries = []
        for room_index, room_entry in enumerate(sorted(rooms_for_exam.values(), key=lambda item: item['room_name'])):
            suggested = None
            for teacher in teacher_pool:
                occupied = any(
                    booking['teacher_id'] == teacher.id
                    and booking['date'] == exam.exam_date
                    and time_ranges_overlap(exam.start_time, exam.end_time, booking['start_time'], booking['end_time'])
                    for booking in scheduled_invigilators
                )
                if not occupied:
                    suggested = teacher
                    break

            if suggested is None and teacher_pool:
                suggested = teacher_pool[room_index % len(teacher_pool)]

            if suggested is not None:
                scheduled_invigilators.append(
                    {
                        'teacher_id': suggested.id,
                        'date': exam.exam_date,
                        'start_time': exam.start_time,
                        'end_time': exam.end_time,
                    }
                )
                suggested_invigilators += 1

            room_entry['suggested_invigilator'] = _teacher_payload(suggested)
            room_entry['occupancy_percent'] = round(
                (room_entry['assigned_students'] / room_entry['capacity']) * 100, 2
            ) if room_entry['capacity'] else 0
            room_entries.append(room_entry)

            room_usage_entry = room_usage.setdefault(
                room_entry['room_id'],
                {
                    'room_id': room_entry['room_id'],
                    'room_name': room_entry['room_name'],
                    'building': room_entry['building'],
                    'capacity': room_entry['capacity'],
                    'rows': room_entry['rows'],
                    'columns': room_entry['columns'],
                    'assigned_students': 0,
                    'daily_total_students': 0,
                    'exams': [],
                    'invigilators': [],
                },
            )
            room_usage_entry['assigned_students'] = max(
                room_usage_entry['assigned_students'],
                room_entry['assigned_students'],
            )
            room_usage_entry['daily_total_students'] += room_entry['assigned_students']
            room_usage_entry['exams'].append(
                {
                    'exam_id': exam.id,
                    'exam_name': exam.name,
                    'subject_name': exam.subject.name if exam.subject else '',
                    'class_name': exam.class_name,
                    'section': exam.section or '',
                    'start_time': exam.start_time.isoformat() if exam.start_time else None,
                    'end_time': exam.end_time.isoformat() if exam.end_time else None,
                    'assigned_students': room_entry['assigned_students'],
                }
            )
            if room_entry['suggested_invigilator'] is not None:
                room_usage_entry['invigilators'].append(room_entry['suggested_invigilator'])
                invigilator_roster.append(
                    {
                        'exam_id': exam.id,
                        'exam_name': exam.name,
                        'subject_name': exam.subject.name if exam.subject else '',
                        'class_name': exam.class_name,
                        'section': exam.section or '',
                        'room_id': room_entry['room_id'],
                        'room_name': room_entry['room_name'],
                        'start_time': exam.start_time.isoformat() if exam.start_time else None,
                        'end_time': exam.end_time.isoformat() if exam.end_time else None,
                        'teacher': room_entry['suggested_invigilator'],
                    }
                )

        total_invigilator_slots += len(room_entries)

        session_candidates = sessions_by_class.get(_class_section_key(exam.class_name, exam.section), [])
        attendance_session = None
        if session_candidates:
            attendance_session = next(
                (session for session in session_candidates if session.subject_id == exam.subject_id),
                session_candidates[0],
            )

        attendance_payload = {
            'status': 'not_started',
            'session_id': None,
            'subject_name': None,
            'marked_students': 0,
            'present_count': 0,
            'expected_students': expected_students,
            'coverage_percent': 0,
        }
        if attendance_session:
            attendance_sessions_ready += 1
            marked_students = attendance_session.attendances.values('student_id').distinct().count()
            present_count = attendance_session.attendances.filter(status__in=['present', 'late', 'excused']).count()
            coverage_percent = round((marked_students / expected_students) * 100, 2) if expected_students else 0

            attendance_payload.update(
                {
                    'session_id': attendance_session.id,
                    'subject_name': attendance_session.subject.name if attendance_session.subject else None,
                    'marked_students': marked_students,
                    'present_count': present_count,
                    'coverage_percent': coverage_percent,
                }
            )

            if expected_students and marked_students >= expected_students:
                attendance_payload['status'] = 'complete'
                attendance_complete += 1
            elif marked_students > 0:
                attendance_payload['status'] = 'in_progress'
            else:
                attendance_payload['status'] = 'session_ready'

        seat_completion = round((len(assignments) / expected_students) * 100, 2) if expected_students else 0
        if expected_students and len(assignments) < expected_students:
            alerts.append(
                {
                    'type': 'seat_plan',
                    'severity': 'warning',
                    'message': (
                        f"{exam.name} for Class {exam.class_name}{(' ' + exam.section) if exam.section else ''} "
                        f"is missing {expected_students - len(assignments)} seat assignments."
                    ),
                    'link': '/admin/exam-routine',
                }
            )
        if attendance_payload['status'] == 'not_started':
            alerts.append(
                {
                    'type': 'attendance',
                    'severity': 'info',
                    'message': (
                        f"Attendance session has not been created for Class {exam.class_name}"
                        f"{(' ' + exam.section) if exam.section else ''}."
                    ),
                    'link': '/admin/attendance',
                }
            )

        exam_rows.append(
            {
                'id': exam.id,
                'name': exam.name,
                'subject_name': exam.subject.name if exam.subject else '',
                'class_name': exam.class_name,
                'section': exam.section or '',
                'exam_type': exam.exam_type,
                'exam_date': exam.exam_date.isoformat() if exam.exam_date else None,
                'start_time': exam.start_time.isoformat() if exam.start_time else None,
                'end_time': exam.end_time.isoformat() if exam.end_time else None,
                'expected_students': expected_students,
                'assigned_seats': len(assignments),
                'seat_completion_percent': seat_completion,
                'lead_teacher': _teacher_payload(subject_teacher),
                'attendance': attendance_payload,
                'rooms': room_entries,
                'room_count': len(room_entries),
            }
        )

    for room_entry in room_usage.values():
        room_entry['occupancy_percent'] = round(
            (room_entry['assigned_students'] / room_entry['capacity']) * 100, 2
        ) if room_entry['capacity'] else 0

    total_rooms_in_use = len(room_usage)

    return {
        'selected_date': target_date.isoformat(),
        'metrics': {
            'total_exams': len(exams),
            'expected_students': total_expected_students,
            'assigned_seats': total_assigned_seats,
            'seat_completion_percent': round((total_assigned_seats / total_expected_students) * 100, 2)
            if total_expected_students
            else 0,
            'rooms_in_use': total_rooms_in_use,
            'attendance_sessions_ready': attendance_sessions_ready,
            'attendance_complete': attendance_complete,
            'invigilator_slots': total_invigilator_slots,
            'suggested_invigilators': suggested_invigilators,
        },
        'exams': exam_rows,
        'rooms': sorted(room_usage.values(), key=lambda item: item['room_name']),
        'invigilators': invigilator_roster,
        'alerts': alerts[:8],
        'generated_at': timezone.now().isoformat(),
    }


def build_admin_assistant_response(query=''):
    pending = _pending_work()
    risks = _risk_snapshot()
    notice_analytics = build_notice_analytics()
    schedule_conflicts = collect_schedule_conflicts(limit=5)
    exam_conflicts = collect_exam_conflicts(limit=5)

    prompt = (query or '').strip().lower()
    answer = []
    suggestions = []
    drafts = []

    if 'notice' in prompt or 'announce' in prompt:
        answer.append(
            f"You have {notice_analytics['summary']['active_notices']} active notices with an average read rate of {notice_analytics['summary']['average_read_rate']}%."
        )
        drafts.append({
            'title': 'Attendance and Deadlines Reminder',
            'audience': 'students',
            'content': (
                "Please review your attendance, upcoming exam routine, and pending task deadlines. "
                "Students with low attendance should meet their class teacher this week."
            ),
        })
        suggestions.extend([
            'Publish a student reminder notice before the next exam window.',
            'Pin one urgent notice instead of posting several medium-priority notices.',
        ])
    elif 'exam' in prompt or 'routine' in prompt or 'conflict' in prompt:
        answer.append(
            f"There are {len(exam_conflicts)} active exam conflicts and {len(schedule_conflicts)} timetable conflicts detected right now."
        )
        suggestions.extend([
            'Resolve teacher-overlap conflicts before locking the routine.',
            'Use the conflict panels in timetable and exam management to clean duplicates.',
        ])
    elif 'attendance' in prompt or 'risk' in prompt:
        answer.append(
            f"{risks['low_attendance_count']} students are below 75% attendance, and {risks['overdue_books']} library issues are overdue."
        )
        suggestions.extend([
            'Contact low-attendance students first, starting with the lowest percentages.',
            'Bundle parent communication with exam reminders for better response rates.',
        ])
        if risks['low_attendance_students']:
            drafts.append({
                'title': 'Parent Follow-up Draft',
                'audience': 'parents',
                'content': (
                    f"We are monitoring attendance closely. {risks['low_attendance_students'][0]['student_name']} "
                    "needs immediate improvement to stay on track academically."
                ),
            })
    else:
        answer.append(
            f"You currently have {sum(pending.values())} pending workflow items, {len(schedule_conflicts)} timetable conflicts, and {len(exam_conflicts)} exam conflicts."
        )
        answer.append(
            f"Communication health is moderate, with an average notice read rate of {notice_analytics['summary']['average_read_rate']}%."
        )
        suggestions.extend([
            'Clear pending results and service requests first because they affect multiple user roles.',
            'Use the document center to publish report cards and exam circulars in one workflow.',
            'Send one targeted notice for low-attendance students and another for upcoming exams.',
        ])

    if not drafts:
        drafts.append({
            'title': 'Admin Action Brief',
            'audience': 'staff',
            'content': (
                "Please review pending approvals, resolve schedule conflicts, and confirm communication updates before the next academic cycle."
            ),
        })

    return {
        'answer': ' '.join(answer).strip(),
        'suggested_actions': suggestions,
        'drafts': drafts,
        'metrics': {
            'pending_work': pending,
            'low_attendance_count': risks['low_attendance_count'],
            'overdue_books': risks['overdue_books'],
            'schedule_conflicts': len(schedule_conflicts),
            'exam_conflicts': len(exam_conflicts),
        },
    }


def build_admin_overview():
    notice_analytics = build_notice_analytics()
    schedule_conflicts = collect_schedule_conflicts(limit=10)
    exam_conflicts = collect_exam_conflicts(limit=10)
    unread_notifications = UserNotification.objects.filter(user__role='admin', is_read=False).count()
    assistant = build_admin_assistant_response()

    return {
        'stats': _role_counts(),
        'pending_work': _pending_work(),
        'health': {
            'schedule_conflicts': len(schedule_conflicts),
            'exam_conflicts': len(exam_conflicts),
            'overdue_books': BookIssue.objects.filter(status__in=['issued', 'overdue'], due_date__lt=timezone.localdate()).count(),
            'unread_admin_notifications': unread_notifications,
        },
        'recent_activity': _recent_activity(),
        'notice_analytics': notice_analytics,
        'document_snapshot': _document_snapshot(),
        'assistant': assistant,
        'schedule_conflicts': schedule_conflicts,
        'exam_conflicts': exam_conflicts,
        'generated_at': timezone.now().isoformat(),
    }
