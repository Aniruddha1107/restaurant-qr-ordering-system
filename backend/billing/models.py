from django.db import models
from orders.models import Order

class Bill(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='bill')
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    gst = models.DecimalField(max_digits=10, decimal_places=2)  # 5% GST
    service_charge = models.DecimalField(max_digits=10, decimal_places=2)  # 2% Service Charge
    total = models.DecimalField(max_digits=10, decimal_places=2)
    is_paid = models.BooleanField(default=False)
    razorpay_order_id = models.CharField(max_length=100, blank=True, null=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True, null=True)
    razorpay_signature = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Bill for Order #{self.order.id} - Total: ₹{self.total} ({'Paid' if self.is_paid else 'Unpaid'})"
