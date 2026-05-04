from collections import defaultdict
from datetime import datetime, time, timedelta

from django.db.models import Count, Q
from django.utils import timezone

from attendance.models import Attendance, AttendanceSession, LeaveRequest
from notices.models import Notice, NoticeRead
from results.conflicts import resolve_exam_teacher
from results.models import Exam, Result
from service_requests.models import ServiceRequest
from students.models import ConsentRequest, Student
from tasks.models import Task, TaskSubmission


def _class_section_key(class_name, section=''):
    return (str(class_name or '').strip(), str(section or '').strip())


def _student_payload(student):
    return {
        'id': student.id,
        'student_id': student.student_id,
        'name': student.user.get_full_name() or student.student_id,
        'class_name': student.current_class,
        'section': student.current_section or '',
        'roll_number': student.roll_number or '',
        'parent_count': len(student.parent_profiles.all()),
    }


def _class_payload(class_name, section=''):
    return {
        'class_name': class_name,
        'section': section or '',
        'label': f"Class {class_name}{(' ' + section) if section else ''}",
    }


def _percent(numerator, denominator, default_value=0):
    if not denominator:
        return default_value
    return round((numerator / denominator) * 100, 2)


def _average(values, default_value=None):
    if not values:
        return default_value
    return round(sum(values) / len(values), 2)


def _sort_stamp(raw_value):
    if raw_value is None:
        return timezone.make_aware(datetime.min)
    if isinstance(raw_value, datetime):
        return raw_value if timezone.is_aware(raw_value) else timezone.make_aware(raw_value)
    if hasattr(raw_value, 'year') and hasattr(raw_value, 'month') and hasattr(raw_value, 'day'):
        return timezone.make_aware(datetime.combine(raw_value, time.min))
    return timezone.make_aware(datetime.min)


def _risk_color_band(score):
    if score >= 65:
        return 'high'
    if score >= 35:
        return 'medium'
    return 'low'


def _unique_list(values):
    seen = set()
    output = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        output.append(value)
    return output


def _build_student_risk(metric):
    attendance_percent = metric.get('attendance_percent', 100)
    avg_result_percent = metric.get('avg_result_percent')
    task_submission_rate = metric.get('task_submission_rate')
    overdue_missing_tasks = metric.get('overdue_missing_tasks', 0)
    pending_total = metric.get('pending_services', 0) + metric.get('pending_consents', 0) + metric.get('pending_leaves', 0)

    score = 0
    reasons = []
    actions = []

    if metric.get('attendance_total', 0) > 0 and attendance_percent < 75:
        score += min(35, int(round((75 - attendance_percent) * 0.9 + 10)))
        reasons.append(f"Attendance is {attendance_percent}% and below the 75% threshold.")
        actions.append("Contact the parent and class teacher to review attendance this week.")

    if avg_result_percent is not None and avg_result_percent < 50:
        score += min(30, int(round((50 - avg_result_percent) * 0.8 + 8)))
        reasons.append(f"Approved result average is {avg_result_percent}%.")
        actions.append("Schedule remedial support for the weakest exam subjects.")

    if task_submission_rate is not None and task_submission_rate < 65:
        score += min(20, int(round((65 - task_submission_rate) * 0.5 + 5)))
        reasons.append(f"Task submission rate is only {task_submission_rate}%.")
        actions.append("Review missing homework and agree a recovery deadline plan.")

    if overdue_missing_tasks > 0:
        score += min(10, overdue_missing_tasks * 3)
        reasons.append(f"{overdue_missing_tasks} overdue task(s) still have no submission.")
        actions.append("Follow up on overdue tasks before the next class meeting.")

    if pending_total > 0:
        score += min(8, pending_total * 2)
        reasons.append(f"{pending_total} pending support or approval item(s) need attention.")
        actions.append("Clear the pending request or consent workflow to remove blockers.")

    if len(metric['student'].parent_profiles.all()) == 0:
        actions.append("Verify that a parent or guardian account is linked for escalation.")

    score = min(score, 100)
    return {
        'risk_score': score,
        'risk_band': _risk_color_band(score),
        'reasons': _unique_list(reasons),
        'actions': _unique_list(actions),
    }


def _build_exam_readiness():
    today = timezone.localdate()
    upcoming_exams = list(
        Exam.objects.filter(exam_date__gte=today, is_active=True)
        .select_related('subject')
        .prefetch_related('seat_assignments__room')
        .order_by('exam_date', 'start_time', 'class_name', 'section', 'name')[:8]
    )

    sessions = list(
        AttendanceSession.objects.filter(date__gte=today, date__lte=today + timedelta(days=7), period=1)
        .select_related('subject')
    )
    session_lookup = {
        (
            str(session.date),
            str(session.class_name or '').strip(),
            str(session.section or '').strip(),
            session.subject_id,
        ): session
        for session in sessions
    }

    rows = []
    for exam in upcoming_exams:
        expected_students = exam.candidate_count()
        assigned_seats = exam.seat_assignments.count()
        room_count = exam.seat_assignments.values('room_id').distinct().count()
        lead_teacher = None
        try:
            lead_teacher = resolve_exam_teacher(exam.class_name, exam.section, exam.subject_id)
        except Exception:
            lead_teacher = None

        session = session_lookup.get((str(exam.exam_date), str(exam.class_name or '').strip(), str(exam.section or '').strip(), exam.subject_id))
        flags = []
        seat_score = _percent(assigned_seats, expected_students, default_value=100 if expected_students == 0 else 0)
        room_score = 100 if room_count > 0 else 0
        teacher_score = 100 if lead_teacher else 0
        schedule_score = 100 if exam.start_time and exam.end_time else 0
        attendance_score = 100 if (exam.exam_date > today or session) else 0

        if expected_students and assigned_seats < expected_students:
            flags.append(f"{expected_students - assigned_seats} student seat(s) still need assignment.")
        if room_count == 0:
            flags.append("No room has been assigned yet.")
        if not lead_teacher:
            flags.append("No lead teacher is mapped for this subject and class.")
        if not (exam.start_time and exam.end_time):
            flags.append("Exam time window is incomplete.")
        if exam.exam_date == today and not session:
            flags.append("Attendance session has not been created for today.")

        readiness_score = round(
            (seat_score * 0.4) +
            (room_score * 0.2) +
            (teacher_score * 0.2) +
            (schedule_score * 0.1) +
            (attendance_score * 0.1),
            2,
        )

        if readiness_score >= 85:
            status = 'ready'
        elif readiness_score >= 60:
            status = 'almost_ready'
        else:
            status = 'needs_attention'

        rows.append(
            {
                'id': exam.id,
                'name': exam.name,
                'subject_name': exam.subject.name if exam.subject else '',
                'class_name': exam.class_name,
                'section': exam.section or '',
                'exam_date': exam.exam_date.isoformat() if exam.exam_date else None,
                'start_time': exam.start_time.isoformat() if exam.start_time else None,
                'end_time': exam.end_time.isoformat() if exam.end_time else None,
                'expected_students': expected_students,
                'assigned_seats': assigned_seats,
                'room_count': room_count,
                'lead_teacher_name': lead_teacher.user.get_full_name() if lead_teacher and lead_teacher.user else None,
                'readiness_score': readiness_score,
                'status': status,
                'flags': flags,
            }
        )

    average_score = _average([row['readiness_score'] for row in rows], default_value=0)
    return {
        'summary': {
            'upcoming_exam_count': len(rows),
            'average_score': average_score,
            'ready_count': len([row for row in rows if row['status'] == 'ready']),
            'attention_count': len([row for row in rows if row['status'] == 'needs_attention']),
        },
        'exams': rows,
    }


def build_admin_intelligence_hub():
    recent_task_cutoff = timezone.now() - timedelta(days=180)

    students = list(
        Student.objects.filter(is_active=True)
        .select_related('user')
        .prefetch_related('parent_profiles')
        .order_by('current_class', 'current_section', 'roll_number', 'student_id')
    )
    if not students:
        return {
            'student_360': {'students': []},
            'intervention_planner': {'plans': []},
            'exam_readiness': _build_exam_readiness(),
            'homework_result_analyzer': {'classes': []},
            'academic_health': {'classes': []},
            'generated_at': timezone.now().isoformat(),
        }

    students_by_id = {student.id: student for student in students}
    student_ids = list(students_by_id.keys())
    class_rosters = defaultdict(list)
    class_only_rosters = defaultdict(list)
    class_metrics = {}
    student_metrics = {}

    for student in students:
        class_key = _class_section_key(student.current_class, student.current_section)
        class_rosters[class_key].append(student.id)
        class_only_rosters[str(student.current_class or '').strip()].append(student.id)
        class_metrics.setdefault(
            class_key,
            {
                **_class_payload(student.current_class, student.current_section),
                'student_count': 0,
                'student_ids': [],
                'attendance_percentages': [],
                'result_percentages': [],
                'task_assigned': 0,
                'task_submitted': 0,
                'task_score_percentages': [],
                'notice_read_percentages': [],
                'overdue_missing_tasks': 0,
                'pending_services': 0,
                'pending_consents': 0,
                'pending_leaves': 0,
                'high_risk_students': 0,
            },
        )
        class_metrics[class_key]['student_count'] += 1
        class_metrics[class_key]['student_ids'].append(student.id)
        student_metrics[student.id] = {
            'student': student,
            'class_key': class_key,
            'attendance_total': 0,
            'attendance_present': 0,
            'attendance_absent': 0,
            'attendance_late': 0,
            'result_percentages': [],
            'task_assigned': 0,
            'task_submitted': 0,
            'task_score_percentages': [],
            'overdue_missing_tasks': 0,
            'overdue_task_titles': [],
            'pending_services': 0,
            'pending_consents': 0,
            'pending_leaves': 0,
            'notice_read_count': 0,
        }

    attendance_rows = Attendance.objects.filter(student_id__in=student_ids).values('student_id').annotate(
        total=Count('id'),
        present=Count('id', filter=Q(status__in=['present', 'late', 'excused'])),
        absent=Count('id', filter=Q(status='absent')),
        late=Count('id', filter=Q(status='late')),
    )
    for row in attendance_rows:
        metric = student_metrics.get(row['student_id'])
        if not metric:
            continue
        metric['attendance_total'] = row['total'] or 0
        metric['attendance_present'] = row['present'] or 0
        metric['attendance_absent'] = row['absent'] or 0
        metric['attendance_late'] = row['late'] or 0

    approved_results = list(
        Result.objects.filter(status='approved', student_id__in=student_ids)
        .select_related('student__user', 'exam', 'exam__subject')
        .order_by('-approved_at', '-updated_at')
    )
    for result in approved_results:
        total_marks = float(result.exam.total_marks or 0) if result.exam else 0
        percentage = round((float(result.marks_obtained or 0) / total_marks) * 100, 2) if total_marks else 0
        metric = student_metrics.get(result.student_id)
        if not metric:
            continue
        metric['result_percentages'].append(percentage)
        class_metrics[metric['class_key']]['result_percentages'].append(percentage)

    submissions = list(
        TaskSubmission.objects.filter(student_id__in=student_ids)
        .select_related('task')
        .order_by('-submitted_at', '-updated_at')
    )
    submissions_by_task_student = {(submission.task_id, submission.student_id): submission for submission in submissions}
    recent_tasks = list(
        Task.objects.filter(status__in=['active', 'closed'], due_date__gte=recent_task_cutoff)
        .prefetch_related('assigned_to_students')
        .order_by('-due_date')
    )

    now = timezone.now()
    for task in recent_tasks:
        eligible_ids = set(task.assigned_to_students.values_list('id', flat=True))
        class_name = str(task.assigned_to_class or '').strip()
        section = str(task.assigned_to_section or '').strip()
        if class_name:
            if section:
                eligible_ids.update(class_rosters.get(_class_section_key(class_name, section), []))
            else:
                eligible_ids.update(class_only_rosters.get(class_name, []))

        for student_id in eligible_ids:
            metric = student_metrics.get(student_id)
            if not metric:
                continue
            metric['task_assigned'] += 1
            class_metric = class_metrics[metric['class_key']]
            class_metric['task_assigned'] += 1

            submission = submissions_by_task_student.get((task.id, student_id))
            if submission and submission.status in ['submitted', 'graded']:
                metric['task_submitted'] += 1
                class_metric['task_submitted'] += 1
                if submission.score is not None and task.total_marks:
                    score_percentage = round((float(submission.score) / float(task.total_marks)) * 100, 2)
                    metric['task_score_percentages'].append(score_percentage)
                    class_metric['task_score_percentages'].append(score_percentage)
            elif task.due_date < now:
                metric['overdue_missing_tasks'] += 1
                metric['overdue_task_titles'].append({'title': task.title, 'due_date': task.due_date})
                class_metric['overdue_missing_tasks'] += 1

    pending_service_rows = ServiceRequest.objects.filter(
        student_id__in=student_ids,
        status__in=['pending', 'in_progress'],
    ).values('student_id').annotate(total=Count('id'))
    for row in pending_service_rows:
        metric = student_metrics.get(row['student_id'])
        if not metric:
            continue
        metric['pending_services'] = row['total']
        class_metrics[metric['class_key']]['pending_services'] += row['total']

    pending_consent_rows = ConsentRequest.objects.filter(
        student_id__in=student_ids,
        status='pending',
    ).values('student_id').annotate(total=Count('id'))
    for row in pending_consent_rows:
        metric = student_metrics.get(row['student_id'])
        if not metric:
            continue
        metric['pending_consents'] = row['total']
        class_metrics[metric['class_key']]['pending_consents'] += row['total']

    pending_leave_rows = LeaveRequest.objects.filter(
        student_id__in=student_ids,
        status='pending',
    ).values('student_id').annotate(total=Count('id'))
    for row in pending_leave_rows:
        metric = student_metrics.get(row['student_id'])
        if not metric:
            continue
        metric['pending_leaves'] = row['total']
        class_metrics[metric['class_key']]['pending_leaves'] += row['total']

    active_notice_ids = list(
        Notice.objects.filter(is_active=True, target_audience__in=['all', 'students']).values_list('id', flat=True)
    )
    if active_notice_ids:
        read_rows = NoticeRead.objects.filter(
            notice_id__in=active_notice_ids,
            user__student_profile__id__in=student_ids,
        ).values('user__student_profile').annotate(total=Count('notice_id', distinct=True))
        reads_by_student = {row['user__student_profile']: row['total'] for row in read_rows}
    else:
        reads_by_student = {}

    for student_id, metric in student_metrics.items():
        metric['notice_read_count'] = reads_by_student.get(student_id, 0)
        metric['notice_read_percent'] = (
            _percent(metric['notice_read_count'], len(active_notice_ids), default_value=100)
            if active_notice_ids
            else 100
        )
        metric['attendance_percent'] = _percent(metric['attendance_present'], metric['attendance_total'], default_value=100)
        metric['avg_result_percent'] = _average(metric['result_percentages'])
        metric['task_submission_rate'] = (
            _percent(metric['task_submitted'], metric['task_assigned'], default_value=100)
            if metric['task_assigned']
            else None
        )
        metric['avg_task_percent'] = _average(metric['task_score_percentages'])

        if metric['attendance_total'] > 0:
            class_metrics[metric['class_key']]['attendance_percentages'].append(metric['attendance_percent'])
        class_metrics[metric['class_key']]['notice_read_percentages'].append(metric['notice_read_percent'])

        risk = _build_student_risk(metric)
        metric.update(risk)
        if risk['risk_score'] >= 35:
            class_metrics[metric['class_key']]['high_risk_students'] += 1

    ranked_students = sorted(
        student_metrics.values(),
        key=lambda item: (
            -item['risk_score'],
            item['attendance_percent'],
            item['avg_result_percent'] if item['avg_result_percent'] is not None else 100,
            item['task_submission_rate'] if item['task_submission_rate'] is not None else 100,
        ),
    )
    spotlight_metrics = ranked_students[:3]
    spotlight_ids = [metric['student'].id for metric in spotlight_metrics]

    attendance_events = defaultdict(list)
    for attendance in Attendance.objects.filter(
        student_id__in=spotlight_ids,
    ).filter(
        Q(status='absent') | Q(status='late') | Q(status='excused')
    ).select_related('subject').order_by('-date')[:24]:
        attendance_events[attendance.student_id].append(attendance)

    result_events = defaultdict(list)
    for result in Result.objects.filter(student_id__in=spotlight_ids).select_related('exam', 'exam__subject').order_by('-approved_at', '-updated_at')[:24]:
        result_events[result.student_id].append(result)

    task_events = defaultdict(list)
    for submission in TaskSubmission.objects.filter(student_id__in=spotlight_ids).select_related('task').order_by('-updated_at')[:24]:
        task_events[submission.student_id].append(submission)

    service_events = defaultdict(list)
    for request in ServiceRequest.objects.filter(student_id__in=spotlight_ids).order_by('-updated_at')[:12]:
        service_events[request.student_id].append(request)

    consent_events = defaultdict(list)
    for consent in ConsentRequest.objects.filter(student_id__in=spotlight_ids).order_by('-created_at')[:12]:
        consent_events[consent.student_id].append(consent)

    leave_events = defaultdict(list)
    for leave in LeaveRequest.objects.filter(student_id__in=spotlight_ids).order_by('-created_at')[:12]:
        leave_events[leave.student_id].append(leave)

    student_360_rows = []
    intervention_rows = []

    for metric in spotlight_metrics:
        student = metric['student']
        timeline = []
        for attendance in attendance_events.get(student.id, [])[:2]:
            timeline.append(
                (
                    _sort_stamp(attendance.date),
                    {
                        'type': 'attendance',
                        'title': f"{attendance.status.title()} in {attendance.subject.name if attendance.subject else 'attendance'}",
                        'description': f"Recorded on {attendance.date.isoformat()}",
                        'time': attendance.date.isoformat(),
                        'status': attendance.status,
                    },
                )
            )
        for result in result_events.get(student.id, [])[:2]:
            total_marks = float(result.exam.total_marks or 0) if result.exam else 0
            percentage = round((float(result.marks_obtained or 0) / total_marks) * 100, 2) if total_marks else 0
            timeline.append(
                (
                    _sort_stamp(result.approved_at or result.updated_at),
                    {
                        'type': 'result',
                        'title': f"Result update for {result.exam.subject.name if result.exam and result.exam.subject else result.exam.name if result.exam else 'exam'}",
                        'description': f"Scored {result.marks_obtained}/{result.exam.total_marks if result.exam else '-'} ({percentage}%)",
                        'time': (result.approved_at or result.updated_at).isoformat() if (result.approved_at or result.updated_at) else None,
                        'status': result.status,
                    },
                )
            )
        for submission in task_events.get(student.id, [])[:2]:
            descriptor = 'Graded task' if submission.status == 'graded' else 'Submitted task'
            extra = f"Score {submission.score}/{submission.task.total_marks}" if submission.score is not None else 'Awaiting grading'
            timeline.append(
                (
                    _sort_stamp(submission.updated_at),
                    {
                        'type': 'task',
                        'title': f"{descriptor}: {submission.task.title}",
                        'description': extra,
                        'time': submission.updated_at.isoformat() if submission.updated_at else None,
                        'status': submission.status,
                    },
                )
            )
        for request in service_events.get(student.id, [])[:1]:
            timeline.append(
                (
                    _sort_stamp(request.updated_at),
                    {
                        'type': 'service_request',
                        'title': f"Service request: {request.title}",
                        'description': f"Status: {request.get_status_display()}",
                        'time': request.updated_at.isoformat() if request.updated_at else None,
                        'status': request.status,
                    },
                )
            )
        for consent in consent_events.get(student.id, [])[:1]:
            timeline.append(
                (
                    _sort_stamp(consent.created_at),
                    {
                        'type': 'consent',
                        'title': f"Consent form: {consent.title}",
                        'description': f"Status: {consent.get_status_display()}",
                        'time': consent.created_at.isoformat() if consent.created_at else None,
                        'status': consent.status,
                    },
                )
            )
        for leave in leave_events.get(student.id, [])[:1]:
            timeline.append(
                (
                    _sort_stamp(leave.created_at),
                    {
                        'type': 'leave',
                        'title': 'Leave request submitted',
                        'description': f"{leave.start_date.isoformat()} to {leave.end_date.isoformat()}",
                        'time': leave.created_at.isoformat() if leave.created_at else None,
                        'status': leave.status,
                    },
                )
            )
        for overdue in metric['overdue_task_titles'][:2]:
            timeline.append(
                (
                    _sort_stamp(overdue['due_date']),
                    {
                        'type': 'task_gap',
                        'title': f"Overdue task: {overdue['title']}",
                        'description': 'No submission recorded by the due date.',
                        'time': overdue['due_date'].isoformat() if overdue['due_date'] else None,
                        'status': 'overdue',
                    },
                )
            )

        timeline.sort(key=lambda item: item[0], reverse=True)
        timeline_payload = [payload for _sort_key, payload in timeline[:6]]

        student_360_rows.append(
            {
                'student': _student_payload(student),
                'risk_score': metric['risk_score'],
                'risk_band': metric['risk_band'],
                'attendance_percent': metric['attendance_percent'],
                'avg_result_percent': metric['avg_result_percent'],
                'task_submission_rate': metric['task_submission_rate'],
                'avg_task_percent': metric['avg_task_percent'],
                'notice_read_percent': metric['notice_read_percent'],
                'overdue_missing_tasks': metric['overdue_missing_tasks'],
                'pending_items': metric['pending_services'] + metric['pending_consents'] + metric['pending_leaves'],
                'timeline': timeline_payload,
            }
        )

    for metric in ranked_students[:5]:
        if metric['risk_score'] <= 0:
            continue
        intervention_rows.append(
            {
                'student': _student_payload(metric['student']),
                'risk_score': metric['risk_score'],
                'risk_band': metric['risk_band'],
                'priority': 'Immediate' if metric['risk_score'] >= 65 else 'Planned',
                'reasons': metric['reasons'][:3],
                'actions': metric['actions'][:4],
                'owner': 'Parent and class teacher' if metric['risk_band'] == 'high' else 'Class teacher',
            }
        )

    analyzer_rows = []
    health_rows = []
    for class_metric in class_metrics.values():
        attendance_score = _average(class_metric['attendance_percentages'], default_value=50)
        result_score = _average(class_metric['result_percentages'], default_value=50)
        submission_rate = (
            _percent(class_metric['task_submitted'], class_metric['task_assigned'], default_value=50)
            if class_metric['task_assigned']
            else 50
        )
        avg_task_percent = _average(class_metric['task_score_percentages'], default_value=50)
        notice_score = _average(class_metric['notice_read_percentages'], default_value=100)
        health_score = round(
            (attendance_score * 0.35) +
            (result_score * 0.3) +
            (submission_rate * 0.2) +
            (notice_score * 0.15),
            2,
        )

        if submission_rate < 60 and result_score < 60:
            alignment_status = 'Homework gaps are likely affecting exam performance.'
        elif submission_rate >= 75 and result_score < 60:
            alignment_status = 'Homework is coming in, but concept mastery is still weak.'
        elif submission_rate < 60 and result_score >= 70:
            alignment_status = 'Results are acceptable, but homework discipline needs follow-up.'
        else:
            alignment_status = 'Homework and result trends are broadly aligned.'

        if health_score >= 85:
            health_status = 'strong'
        elif health_score >= 70:
            health_status = 'stable'
        elif health_score >= 55:
            health_status = 'watch'
        else:
            health_status = 'critical'

        analyzer_rows.append(
            {
                **_class_payload(class_metric['class_name'], class_metric['section']),
                'student_count': class_metric['student_count'],
                'task_submission_rate': submission_rate,
                'avg_task_percent': avg_task_percent,
                'avg_result_percent': result_score,
                'alignment_status': alignment_status,
                'overdue_missing_tasks': class_metric['overdue_missing_tasks'],
            }
        )

        health_rows.append(
            {
                **_class_payload(class_metric['class_name'], class_metric['section']),
                'student_count': class_metric['student_count'],
                'health_score': health_score,
                'status': health_status,
                'attendance_score': attendance_score,
                'result_score': result_score,
                'homework_score': submission_rate,
                'engagement_score': notice_score,
                'high_risk_students': class_metric['high_risk_students'],
            }
        )

    analyzer_rows.sort(key=lambda item: (item['avg_result_percent'], item['task_submission_rate']))
    health_rows.sort(key=lambda item: item['health_score'])

    return {
        'student_360': {
            'students': student_360_rows,
            'generated_for': len(student_360_rows),
        },
        'intervention_planner': {
            'plans': intervention_rows,
            'high_priority_count': len([plan for plan in intervention_rows if plan['priority'] == 'Immediate']),
        },
        'exam_readiness': _build_exam_readiness(),
        'homework_result_analyzer': {
            'classes': analyzer_rows[:6],
        },
        'academic_health': {
            'classes': health_rows[:6],
            'average_score': _average([row['health_score'] for row in health_rows], default_value=0),
        },
        'generated_at': timezone.now().isoformat(),
    }
