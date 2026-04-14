from django.conf import settings
from django.core.mail import send_mail

from .models import UserNotification


def dispatch_alert(user, title, content, link=None, channels=None, phone=None):
    """
    Create an in-app notification and optionally send email/SMS/push.
    SMS/push are no-ops unless you wire providers in settings.
    """
    if not user:
        return None

    notification = UserNotification.objects.create(
        user=user,
        title=title,
        content=content,
        link=link,
    )

    # Email channel
    if (channels is None or 'email' in channels) and getattr(settings, 'EMAIL_HOST', None):
        try:
            if user.email:
                send_mail(
                    subject=title,
                    message=content,
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
                    recipient_list=[user.email],
                    fail_silently=True,
                )
        except Exception:
            pass

    # SMS channel (stub)
    if channels is None or 'sms' in channels:
        sms_enabled = getattr(settings, 'SMS_ENABLED', False)
        if sms_enabled:
            try:
                # Implement provider integration here
                _ = phone or getattr(user, 'phone', None)
            except Exception:
                pass

    # Push channel (stub)
    if channels is None or 'push' in channels:
        push_enabled = getattr(settings, 'PUSH_ENABLED', False)
        if push_enabled:
            try:
                # Implement provider integration here
                pass
            except Exception:
                pass

    return notification
