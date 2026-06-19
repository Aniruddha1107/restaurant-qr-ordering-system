from rest_framework.permissions import BasePermission

class IsRole(BasePermission):
    """Allow access only to users with a specific role (or list of roles)."""
    def __init__(self, allowed_roles):
        if isinstance(allowed_roles, str):
            self.allowed_roles = [allowed_roles]
        else:
            self.allowed_roles = list(allowed_roles)

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in self.allowed_roles
