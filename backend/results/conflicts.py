from .models import ClassSubjectAssignment, Exam


def normalize_text(value):
    return str(value or '').strip().lower()


def time_ranges_overlap(start_a, end_a, start_b, end_b):
    if not start_a or not end_a or not start_b or not end_b:
        return True
    return start_a < end_b and start_b < end_a


def sections_overlap(section_a, section_b):
    normalized_a = normalize_text(section_a)
    normalized_b = normalize_text(section_b)
    if not normalized_a or not normalized_b:
        return True
    return normalized_a == normalized_b


def resolve_exam_teacher(class_name, section, subject_id):
    assignments = ClassSubjectAssignment.objects.select_related('teacher__user').filter(
        class_name__iexact=class_name,
        subject_id=subject_id,
        is_active=True,
    )
    exact = assignments.filter(section__iexact=section).first()
    if exact:
        return exact.teacher
    return assignments.filter(section__in=['', None]).first().teacher if assignments.filter(section__in=['', None]).exists() else None


def exam_entry_payload(exam, teacher=None):
    assigned_teacher = teacher
    if assigned_teacher is None:
        try:
            assigned_teacher = resolve_exam_teacher(exam.class_name, exam.section, exam.subject_id)
        except Exception:
            assigned_teacher = None
    return {
        'id': exam.id,
        'name': exam.name,
        'class_name': exam.class_name,
        'section': exam.section or '',
        'exam_date': exam.exam_date.isoformat() if exam.exam_date else None,
        'start_time': exam.start_time.isoformat() if exam.start_time else None,
        'end_time': exam.end_time.isoformat() if exam.end_time else None,
        'subject_name': exam.subject.name if exam.subject else '',
        'teacher_id': assigned_teacher.id if assigned_teacher else None,
        'teacher_name': assigned_teacher.user.get_full_name() if assigned_teacher and assigned_teacher.user else '',
    }


def get_exam_conflicts_for_candidate(
    *,
    subject_id,
    class_name,
    section='',
    exam_date,
    start_time=None,
    end_time=None,
    instance=None,
):
    qs = Exam.objects.filter(exam_date=exam_date, is_active=True).select_related('subject')
    if instance and instance.pk:
        qs = qs.exclude(pk=instance.pk)

    candidate_teacher = resolve_exam_teacher(class_name, section, subject_id)
    conflicts = []

    for existing in qs:
        if not time_ranges_overlap(start_time, end_time, existing.start_time, existing.end_time):
            continue

        reasons = []
        if normalize_text(existing.class_name) == normalize_text(class_name) and sections_overlap(existing.section, section):
            reasons.append('Class section already has an exam in this time window')

        existing_teacher = None
        try:
            existing_teacher = resolve_exam_teacher(existing.class_name, existing.section, existing.subject_id)
        except Exception:
            existing_teacher = None

        if candidate_teacher and existing_teacher and candidate_teacher.id == existing_teacher.id:
            reasons.append('Assigned teacher already has another exam in this time window')

        if reasons:
            conflicts.append({
                'reasons': reasons,
                'existing': exam_entry_payload(existing, teacher=existing_teacher),
            })

    return conflicts


def collect_exam_conflicts(queryset=None, limit=None):
    exams = list(
        (queryset or Exam.objects.filter(is_active=True))
        .select_related('subject')
        .order_by('exam_date', 'start_time', 'class_name', 'section', 'name')
    )

    conflicts = []
    for index, current in enumerate(exams):
        current_teacher = resolve_exam_teacher(current.class_name, current.section, current.subject_id)
        for other in exams[index + 1:]:
            if current.exam_date != other.exam_date:
                continue
            if not time_ranges_overlap(current.start_time, current.end_time, other.start_time, other.end_time):
                continue

            reasons = []
            if (
                normalize_text(current.class_name) == normalize_text(other.class_name)
                and sections_overlap(current.section, other.section)
            ):
                reasons.append('Class section overlap')

            other_teacher = resolve_exam_teacher(other.class_name, other.section, other.subject_id)
            if current_teacher and other_teacher and current_teacher.id == other_teacher.id:
                reasons.append('Teacher overlap')

            if not reasons:
                continue

            conflicts.append({
                'type': 'exam_conflict',
                'exam_date': current.exam_date.isoformat() if current.exam_date else None,
                'reasons': reasons,
                'entries': [
                    exam_entry_payload(current, teacher=current_teacher),
                    exam_entry_payload(other, teacher=other_teacher),
                ],
            })

            if limit and len(conflicts) >= limit:
                return conflicts

    return conflicts
