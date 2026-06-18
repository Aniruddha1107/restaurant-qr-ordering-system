from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CUSTOMER = 'customer'
    ROLE_CHEF = 'chef'
    ROLE_WAITER = 'waiter'
    ROLE_MANAGER = 'manager'

    ROLE_CHOICES = [
        (ROLE_CUSTOMER, 'Customer'),
        (ROLE_CHEF, 'Chef'),
        (ROLE_WAITER, 'Waiter'),
        (ROLE_MANAGER, 'Manager'),
    ]

    mobile = models.CharField(max_length=20, unique=True, blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_CUSTOMER)

    def __str__(self):
        return f"{self.username or self.mobile or 'User'} ({self.role})"
