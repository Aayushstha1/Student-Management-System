from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from .models import Notice, UserNotification

User = get_user_model()


def audience_user_count(audience):
    if audience == 'all':
        return User.objects.filter(is_active=True).count()
    if audience == 'students':
        return User.objects.filter(is_active=True, role='student').count()
    if audience == 'teachers':
        return User.objects.filter(is_active=True, role='teacher').count()
    if audience == 'parents':
        return User.objects.filter(is_active=True, role='parent').count()
    if audience == 'staff':
        return User.objects.filter(is_active=True, role__in=['admin', 'librarian', 'hostel_warden']).count()
    return 0


def build_notice_analytics(limit=6):
    notices = list(
        Notice.objects.select_related('category', 'published_by')
        .prefetch_related('reads')
        .order_by('-published_at')[:limit]
    )

    detailed_notices = []
    total_read_rate = 0
    read_rate_count = 0
    audience_breakdown = {}

    for notice in notices:
        audience_size = audience_user_count(notice.target_audience)
        read_count = notice.reads.count()
        read_rate = round((read_count / audience_size) * 100, 2) if audience_size else 0
        total_read_rate += read_rate
        read_rate_count += 1

        detailed_notices.append({
            'id': notice.id,
            'title': notice.title,
            'priority': notice.priority,
            'target_audience': notice.target_audience,
            'category_name': notice.category.name if notice.category else '',
            'published_at': notice.published_at.isoformat() if notice.published_at else None,
            'read_count': read_count,
            'audience_size': audience_size,
            'read_rate': read_rate,
            'is_pinned': notice.is_pinned,
        })

        bucket = audience_breakdown.setdefault(notice.target_audience, {
            'target_audience': notice.target_audience,
            'notice_count': 0,
            'average_read_rate': 0,
        })
        bucket['notice_count'] += 1
        bucket['average_read_rate'] += read_rate

    audience_rows = []
    for bucket in audience_breakdown.values():
        notice_count = bucket['notice_count'] or 1
        audience_rows.append({
            **bucket,
            'average_read_rate': round(bucket['average_read_rate'] / notice_count, 2),
        })

    since = timezone.now() - timedelta(days=7)
    daily_notifications = (
        UserNotification.objects.filter(created_at__gte=since)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(total=Count('id'))
        .order_by('day')
    )
    notification_volume = [
        {
            'day': item['day'].isoformat() if item['day'] else None,
            'total': item['total'],
        }
        for item in daily_notifications
    ]

    unread_by_role = []
    for role, label in User.ROLE_CHOICES:
        total = UserNotification.objects.filter(user__role=role).count()
        unread = UserNotification.objects.filter(user__role=role, is_read=False).count()
        unread_by_role.append({
            'role': role,
            'label': label,
            'total_notifications': total,
            'unread_notifications': unread,
        })

    return {
        'summary': {
            'active_notices': Notice.objects.filter(is_active=True).count(),
            'pinned_notices': Notice.objects.filter(is_active=True, is_pinned=True).count(),
            'urgent_notices': Notice.objects.filter(is_active=True, priority='urgent').count(),
            'average_read_rate': round(total_read_rate / read_rate_count, 2) if read_rate_count else 0,
            'notifications_sent': UserNotification.objects.count(),
        },
        'top_notices': detailed_notices,
        'audience_breakdown': audience_rows,
        'notification_volume': notification_volume,
        'unread_by_role': unread_by_role,
    }
