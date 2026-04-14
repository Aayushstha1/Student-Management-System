from students.models import Student
from .models import ParentProfile


def get_student_for_user(user):
    """Return Student for student/parent users, else None."""
    if not user or not getattr(user, 'is_authenticated', False):
        return None

    role = getattr(user, 'role', None)
    if role == 'student':
        try:
            return Student.objects.get(user=user)
        except Student.DoesNotExist:
            return None
    if role == 'parent':
        try:
            return user.parent_profile.student
        except ParentProfile.DoesNotExist:
            return None
    return None
