from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from authentication.models import OTP
from authentication.permissions import IsChef, IsWaiter, IsManager

User = get_user_model()

# Mock view for testing permissions
class MockChefView(APIView):
    permission_classes = [IsAuthenticated, IsChef]
    def get(self, request):
        return Response({"message": "Hello Chef"})

class MockWaiterView(APIView):
    permission_classes = [IsAuthenticated, IsWaiter]
    def get(self, request):
        return Response({"message": "Hello Waiter"})

class MockManagerView(APIView):
    permission_classes = [IsAuthenticated, IsManager]
    def get(self, request):
        return Response({"message": "Hello Manager"})


class AuthViewsTestCase(APITestCase):
    def setUp(self):
        self.send_otp_url = reverse('send_otp')
        self.verify_otp_url = reverse('verify_otp')
        self.mobile = '+1234567890'

    def test_send_otp_success(self):
        response = self.client.post(self.send_otp_url, {'mobile': self.mobile})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertTrue(OTP.objects.filter(mobile=self.mobile).exists())

    def test_send_otp_missing_mobile(self):
        response = self.client.post(self.send_otp_url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_otp_success_creates_user(self):
        otp = OTP.objects.create(mobile=self.mobile, code='123456')
        response = self.client.post(self.verify_otp_url, {'mobile': self.mobile, 'code': '123456'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        
        # Verify user creation in custom User model
        user = User.objects.get(username=self.mobile)
        self.assertEqual(user.mobile, self.mobile)
        self.assertEqual(user.role, User.ROLE_CUSTOMER)

    def test_verify_otp_invalid(self):
        otp = OTP.objects.create(mobile=self.mobile, code='123456')
        response = self.client.post(self.verify_otp_url, {'mobile': self.mobile, 'code': '000000'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PermissionsTestCase(APITestCase):
    def setUp(self):
        self.chef_user = User.objects.create_user(username="chef", role=User.ROLE_CHEF)
        self.waiter_user = User.objects.create_user(username="waiter", role=User.ROLE_WAITER)
        self.manager_user = User.objects.create_user(username="manager", role=User.ROLE_MANAGER)
        self.customer_user = User.objects.create_user(username="customer", role=User.ROLE_CUSTOMER)

    def test_chef_permission(self):
        chef_permission = IsChef()
        # Chef has permission
        self.client.force_authenticate(user=self.chef_user)
        # Create a mock request
        class MockRequest:
            user = self.chef_user
        self.assertTrue(chef_permission.has_permission(MockRequest(), None))
        
        # Customer does not have permission
        class MockRequestCust:
            user = self.customer_user
        self.assertFalse(chef_permission.has_permission(MockRequestCust(), None))

    def test_waiter_permission(self):
        waiter_permission = IsWaiter()
        class MockRequestWaiter:
            user = self.waiter_user
        self.assertTrue(waiter_permission.has_permission(MockRequestWaiter(), None))
        
        class MockRequestChef:
            user = self.chef_user
        self.assertFalse(waiter_permission.has_permission(MockRequestChef(), None))

    def test_manager_permission(self):
        manager_permission = IsManager()
        class MockRequestMgr:
            user = self.manager_user
        self.assertTrue(manager_permission.has_permission(MockRequestMgr(), None))
        
        class MockRequestWaiter:
            user = self.waiter_user
        self.assertFalse(manager_permission.has_permission(MockRequestWaiter(), None))
