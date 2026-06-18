from django.test import TestCase
from authentication.models import OTP

class OTPModelTest(TestCase):
    def test_otp_creation(self):
        otp = OTP.objects.create(mobile="+1234567890", code="123456")
        self.assertEqual(otp.mobile, "+1234567890")
        self.assertTrue(otp.is_valid())
