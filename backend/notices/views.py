from datetime import timedelta

from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import NoticeCategory, Notice, NoticeRead, UserNotification
from .serializers import NoticeCategorySerializer, NoticeSerializer, NoticeReadSerializer, UserNotificationSerializer
from events.models import CalendarEvent


def ensure_tomorrow_holiday_notification(user):
    if getattr(user, 'role', None) != 'student':
        return

    tomorrow = timezone.localdate() + timedelta(days=1)
    holidays = CalendarEvent.objects.filter(event_date=tomorrow, is_holiday=True)
    if not holidays.exists():
        return

    for holiday in holidays:
        title = f"Holiday Tomorrow: {holiday.title} ({holiday.event_date})"
        if UserNotification.objects.filter(user=user, title=title).exists():
            continue
        content = f"Reminder: {tomorrow.strftime('%B %d, %Y')} is a holiday."
        if holiday.description:
            content = f"{content} {holiday.description}"
        UserNotification.objects.create(
            user=user,
            title=title,
            content=content,
            link="/student",
        )


class NoticeCategoryListCreateView(generics.ListCreateAPIView):
    queryset = NoticeCategory.objects.all()
    serializer_class = NoticeCategorySerializer
    permission_classes = [permissions.IsAuthenticated]


class NoticeCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = NoticeCategory.objects.all()
    serializer_class = NoticeCategorySerializer
    permission_classes = [permissions.IsAuthenticated]


class NoticeListCreateView(generics.ListCreateAPIView):
    serializer_class = NoticeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Show only active, non-expired notices, ordered by pinned and date
        from django.utils import timezone
        return Notice.objects.filter(is_active=True).exclude(
            expires_at__lt=timezone.now()
        ).order_by('-is_pinned', '-published_at')

    def perform_create(self, serializer):
        notice = serializer.save(published_by=self.request.user)
        # Notify users based on target audience
        try:
            from django.contrib.auth import get_user_model
            from notices.utils import dispatch_alert
            User = get_user_model()
            audience = notice.target_audience

            if audience == 'all':
                users = User.objects.filter(is_active=True)
            elif audience == 'students':
                users = User.objects.filter(is_active=True, role='student')
            elif audience == 'teachers':
                users = User.objects.filter(is_active=True, role='teacher')
            elif audience == 'staff':
                users = User.objects.filter(is_active=True, role='staff')
            elif audience == 'parents':
                users = User.objects.filter(is_active=True, role='parent')
            else:
                users = User.objects.none()

            for user in users:
                dispatch_alert(
                    user,
                    f"Notice: {notice.title}",
                    notice.content[:200],
                    link="/student/notices" if user.role == 'student' else "/parent/notices" if user.role == 'parent' else "/admin/notices",
                )
        except Exception:
            pass


class NoticeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Notice.objects.all()
    serializer_class = NoticeSerializer
    permission_classes = [permissions.IsAuthenticated]


class MarkNoticeReadView(generics.CreateAPIView):
    queryset = NoticeRead.objects.all()
    serializer_class = NoticeReadSerializer
    permission_classes = [permissions.IsAuthenticated]


class NotificationListView(generics.ListAPIView):
    """List notifications for the authenticated user, newest first."""
    serializer_class = UserNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        ensure_tomorrow_holiday_notification(self.request.user)
        return UserNotification.objects.filter(user=self.request.user).order_by('-created_at')


class NotificationMarkReadView(generics.GenericAPIView):
    """Mark a single notification as read, or mark all as read for the user.

    POST payloads supported:
    - { "id": <notification_id> }  -> marks the given notification as read
    - { "mark_all": true }         -> marks all unread notifications for the user as read
    """
    serializer_class = UserNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        data = request.data or {}
        if data.get('mark_all'):
            updated = UserNotification.objects.filter(user=request.user, is_read=False).update(is_read=True)
            return Response({"marked": updated}, status=status.HTTP_200_OK)

        notif_id = data.get('id')
        if not notif_id:
            return Response({"detail": "Notification id required or set mark_all."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            notif = UserNotification.objects.get(id=notif_id, user=request.user)
        except UserNotification.DoesNotExist:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)

        notif.is_read = True
        notif.save()
        return Response(self.get_serializer(notif).data, status=status.HTTP_200_OK)


class NotificationUnreadCountView(generics.GenericAPIView):
    """Return unread notification count for the authenticated user."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        ensure_tomorrow_holiday_notification(request.user)
        unread = UserNotification.objects.filter(user=request.user, is_read=False).count()
        return Response({"unread": unread}, status=status.HTTP_200_OK)
