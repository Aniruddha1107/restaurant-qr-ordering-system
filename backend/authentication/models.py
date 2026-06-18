from django.db import models
from django.utils import timezone
import datetime

class OTP(models.Model):
    mobile = models.CharField(max_length=20)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self):
        now = timezone.now()
        return (now - self.created_at) < datetime.timedelta(minutes=5)

    def __str__(self):
        return f"{self.mobile} - {self.code}"
