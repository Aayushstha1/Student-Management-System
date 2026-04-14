from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsHostelStaffOrReadOnly(BasePermission):
    """
    Hostel wardens can create/update/delete. Admins can read only.
    """
    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        role = getattr(user, 'role', None)
        if request.method in SAFE_METHODS:
            return role in ['admin', 'hostel_warden']
        return role == 'hostel_warden'


class IsHostelRequestActor(BasePermission):
    """
    Students can create and view their own requests.
    Hostel wardens can manage all requests.
    Admins can read only.
    """
    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        role = getattr(user, 'role', None)
        if request.method in SAFE_METHODS:
            return role in ['admin', 'hostel_warden', 'student']
        if request.method == 'POST':
            return role == 'student'
        return role == 'hostel_warden'


class IsHostelMenuAccess(BasePermission):
    """
    Hostel wardens can create/update/delete menus.
    Admins and students can read.
    """
    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        role = getattr(user, 'role', None)
        if request.method in SAFE_METHODS:
            return role in ['admin', 'hostel_warden', 'student']
        return role == 'hostel_warden'


class IsHostelMaintenanceAccess(BasePermission):
    """
    Students can create maintenance requests.
    Hostel wardens can create/update/delete.
    Admins can read only.
    """
    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        role = getattr(user, 'role', None)
        if request.method in SAFE_METHODS:
            return role in ['admin', 'hostel_warden', 'student']
        if request.method == 'POST':
            return role in ['student', 'hostel_warden']
        return role == 'hostel_warden'
