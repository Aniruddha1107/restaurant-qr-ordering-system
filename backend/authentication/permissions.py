from rest_framework.permissions import BasePermission
from django.contrib.auth import get_user_model

User = get_user_model()

class IsChef(BasePermission):
    """
    Allows access only to users with the 'chef' role.
    """
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == User.ROLE_CHEF
        )

class IsWaiter(BasePermission):
    """
    Allows access only to users with the 'waiter' role.
    """
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == User.ROLE_WAITER
        )

class IsManager(BasePermission):
    """
    Allows access only to users with the 'manager' role.
    """
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == User.ROLE_MANAGER
        )
