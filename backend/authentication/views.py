import random
import requests
from django.conf import settings
from django.contrib.auth import get_user_model
User = get_user_model()
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .models import OTP

class SendOTPView(APIView):
    def post(self, request):
        mobile = request.data.get("mobile")
        if not mobile:
            return Response({"error": "Mobile number is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate 6-digit random code
        code = f"{random.randint(100000, 999999)}"
        
        # Save OTP to database
        OTP.objects.create(mobile=mobile, code=code)
        
        # Log/Print to console for local testing and container logs
        print(f"OTP for {mobile}: {code}", flush=True)
        
        # Textbelt integration (free tier) if configured
        textbelt_key = getattr(settings, "TEXTBELT_API_KEY", None)
        if textbelt_key and not textbelt_key.startswith("your_"):
            try:
                requests.post("https://textbelt.com/text", data={
                    "phone": mobile,
                    "message": f"Your OTP is {code}",
                    "key": textbelt_key,
                })
            except Exception as e:
                print(f"Textbelt delivery failed: {e}")
                
        return Response({"status": "success", "message": "OTP sent successfully."})

class VerifyOTPView(APIView):
    def post(self, request):
        mobile = request.data.get("mobile")
        code = request.data.get("code")
        
        if not mobile or not code:
            return Response({"error": "Mobile and code are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Get the latest OTP for this mobile
        otp = OTP.objects.filter(mobile=mobile).order_by("-created_at").first()
        
        if not otp:
            return Response({"error": "No OTP found for this mobile number"}, status=status.HTTP_400_BAD_REQUEST)
            
        if not otp.is_valid():
            return Response({"error": "OTP has expired"}, status=status.HTTP_400_BAD_REQUEST)
            
        if otp.code != code:
            return Response({"error": "Invalid OTP code"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Success: Delete OTP or mark verified if we want (deleting prevents replay attacks)
        otp.delete()
        
        # Get or create Django user using mobile as username and mobile
        user, created = User.objects.get_or_create(
            username=mobile,
            defaults={'mobile': mobile, 'role': User.ROLE_CUSTOMER}
        )
        
        # Generate SimpleJWT tokens
        refresh = RefreshToken.for_user(user)
        return Response({
            "status": "success",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "role": user.role,
            "mobile": user.mobile
        })
