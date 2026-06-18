from django.urls import path
from .views import CreateRazorpayOrderView, VerifyRazorpayPaymentView, GenerateBillView, InvoiceHTMLView

urlpatterns = [
    path("create-order/", CreateRazorpayOrderView.as_view(), name="create_razorpay_order"),
    path("verify-payment/", VerifyRazorpayPaymentView.as_view(), name="verify_razorpay_payment"),
    path("bill/<int:order_id>/generate/", GenerateBillView.as_view(), name="generate_bill"),
    path("bill/<int:order_id>/invoice/", InvoiceHTMLView.as_view(), name="invoice_html"),
]
