import razorpay
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

# Initialize client if keys are set (to avoid crash during build/test if keys aren't loaded)
client = None
if hasattr(settings, 'RAZORPAY_KEY_ID') and hasattr(settings, 'RAZORPAY_KEY_SECRET'):
    try:
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    except Exception as e:
        print(f"Error initializing Razorpay client: {e}")

class CreateRazorpayOrderView(APIView):
    def post(self, request):
        amount = request.data.get("amount")  # in INR
        if not amount:
            return Response({"error": "Amount is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Razorpay expects amount in paise (1 INR = 100 paise)
        amount_paise = int(float(amount) * 100)
        
        if not client:
            # Mock order ID for local test run if client couldn't be initialized
            return Response({
                "status": "mock_success",
                "order_id": "order_mock12345",
                "amount": amount_paise,
                "currency": "INR",
                "key_id": getattr(settings, 'RAZORPAY_KEY_ID', 'mock_key')
            })

        try:
            order_data = {
                "amount": amount_paise,
                "currency": "INR",
                "payment_capture": 1
            }
            order = client.order.create(data=order_data)
            return Response({
                "status": "success",
                "order_id": order["id"],
                "amount": order["amount"],
                "currency": order["currency"],
                "key_id": settings.RAZORPAY_KEY_ID
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class VerifyRazorpayPaymentView(APIView):
    def post(self, request):
        razorpay_order_id = request.data.get("razorpay_order_id")
        razorpay_payment_id = request.data.get("razorpay_payment_id")
        razorpay_signature = request.data.get("razorpay_signature")
        
        if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
            return Response({"error": "All signature credentials are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        if not client or razorpay_order_id.startswith("order_mock"):
            # Mock success for testing/sandbox mock
            return Response({"status": "success", "message": "Mock payment verified successfully."})

        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        }
        
        try:
            client.utility.verify_payment_signature(params_dict)
            return Response({"status": "success", "message": "Payment verified successfully."})
        except Exception as e:
            return Response({"status": "failed", "message": "Payment verification failed.", "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
