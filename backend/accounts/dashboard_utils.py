from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.utils import timezone

from attendance.models import Attendance, LeaveRequest
from hostel.models import HostelLeaveRequest, HostelMaintenanceRequest, HostelRoomRequest
from library.models import BookIssue
from notices.analytics import build_notice_analytics
from notices.models import UserNotification
from results.conflicts import collect_exam_conflicts
from results.models import Result
from service_requests.models import ServiceRequest
from students.models import ConsentRequest, Student, StudentEmailChangeRequest, StudentPasswordResetRequest
from timetable.conflicts import collect_schedule_conflicts

User = get_user_model()


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
