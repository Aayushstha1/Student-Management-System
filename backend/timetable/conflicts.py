from .models import ClassSchedule


def normalize_text(value):
    return str(value or '').strip().lower()


def time_ranges_overlap(start_a, end_a, start_b, end_b):
    if not start_a or not end_a or not start_b or not end_b:
        return True
    return start_a < end_b and start_b < end_a


def schedule_entry_payload(schedule):
    return {
        'id': schedule.id,
        'class_name': schedule.class_name,
        'section': schedule.section or '',
        'day_of_week': schedule.day_of_week,
        'day_label': schedule.get_day_of_week_display(),
        'period': schedule.period,
        'subject_name': schedule.subject.name if schedule.subject else '',
        'teacher_id': schedule.teacher_id,
        'teacher_name': schedule.teacher.user.get_full_name() if schedule.teacher and schedule.teacher.user else '',
        'start_time': schedule.start_time.isoformat() if schedule.start_time else None,
        'end_time': schedule.end_time.isoformat() if schedule.end_time else None,
        'room': schedule.room or '',
    }


def get_schedule_conflicts_for_candidate(
    *,
    class_name,
    section='',
    day_of_week,
    start_time,
    end_time,
    teacher_id=None,
    room='',
    instance=None,
):
    qs = ClassSchedule.objects.filter(day_of_week=day_of_week, is_active=True).select_related('subject', 'teacher__user')
    if instance and instance.pk:
        qs = qs.exclude(pk=instance.pk)

    conflicts = []
    normalized_class = normalize_text(class_name)
    normalized_section = normalize_text(section)
    normalized_room = normalize_text(room)

    for existing in qs:
        if not time_ranges_overlap(start_time, end_time, existing.start_time, existing.end_time):
            continue

        reasons = []
        if (
            normalize_text(existing.class_name) == normalized_class
            and normalize_text(existing.section) == normalized_section
        ):
            reasons.append('Class section already has a schedule in this time window')
        if teacher_id and existing.teacher_id and existing.teacher_id == teacher_id:
            reasons.append('Teacher is already scheduled in this time window')
        if normalized_room and normalize_text(existing.room) == normalized_room:
            reasons.append('Room is already occupied in this time window')

        if reasons:
            conflicts.append({
                'reasons': reasons,
                'existing': schedule_entry_payload(existing),
            })

    return conflicts


def collect_schedule_conflicts(queryset=None, limit=None):
    schedules = list(
        (queryset or ClassSchedule.objects.filter(is_active=True))
        .select_related('subject', 'teacher__user')
        .order_by('day_of_week', 'start_time', 'class_name', 'section', 'period')
    )

    conflicts = []
    for index, current in enumerate(schedules):
        for other in schedules[index + 1:]:
            if current.day_of_week != other.day_of_week:
                continue
            if not time_ranges_overlap(current.start_time, current.end_time, other.start_time, other.end_time):
                continue

            reasons = []
            if (
                normalize_text(current.class_name) == normalize_text(other.class_name)
                and normalize_text(current.section) == normalize_text(other.section)
            ):
                reasons.append('Class section overlap')
            if current.teacher_id and other.teacher_id and current.teacher_id == other.teacher_id:
                reasons.append('Teacher overlap')
            if normalize_text(current.room) and normalize_text(current.room) == normalize_text(other.room):
                reasons.append('Room overlap')

            if not reasons:
                continue

            conflicts.append({
                'type': 'schedule_conflict',
                'day_of_week': current.day_of_week,
                'day_label': current.get_day_of_week_display(),
                'reasons': reasons,
                'entries': [
                    schedule_entry_payload(current),
                    schedule_entry_payload(other),
                ],
            })

            if limit and len(conflicts) >= limit:
                return conflicts

    return conflicts
