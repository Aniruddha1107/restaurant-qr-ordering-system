from django.db import models
from menu.models import Table

class ServiceRequest(models.Model):
    TYPE_WATER = 'water'
    TYPE_ASSISTANCE = 'assistance'
    TYPE_BILL = 'bill'

    TYPE_CHOICES = [
        (TYPE_WATER, 'Water Call'),
        (TYPE_ASSISTANCE, 'Table Assistance'),
        (TYPE_BILL, 'Request Bill'),
    ]

    STATUS_PENDING = 'pending'
    STATUS_COMPLETED = 'completed'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_COMPLETED, 'Completed'),
    ]

    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name='service_requests')
    request_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_request_type_display()} from Table {self.table.number} ({self.status})"
