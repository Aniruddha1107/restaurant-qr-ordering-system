from rest_framework.test import APITestCase
from django.urls import reverse
from rest_framework import status
from django.contrib.auth import get_user_model
from menu.models import Restaurant, Table
from notifications.models import ServiceRequest

User = get_user_model()

class ServiceRequestAPITestCase(APITestCase):
    def setUp(self):
        self.restaurant = Restaurant.objects.create(name="Red Velvet Bistro")
        self.table = Table.objects.create(restaurant=self.restaurant, number="12")
        self.customer = User.objects.create_user(username="customer", mobile="+1111111111", role="customer", password="password123")
        self.waiter = User.objects.create_user(username="waiter", mobile="+3333333333", role="waiter", password="password123")
        self.create_req_url = reverse('create_service_request')
        self.list_req_url = reverse('list_service_requests')

    def test_create_service_request_customer(self):
        self.client.force_authenticate(user=self.customer)
        payload = {"table_id": self.table.id, "request_type": ServiceRequest.TYPE_WATER}
        response = self.client.post(self.create_req_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ServiceRequest.objects.filter(table=self.table, request_type=ServiceRequest.TYPE_WATER).exists())

    def test_list_service_requests_waiter(self):
        self.client.force_authenticate(user=self.customer)
        # Create a request
        ServiceRequest.objects.create(table=self.table, request_type=ServiceRequest.TYPE_WATER)
        
        # Customer should get forbidden or role error if trying to list requests
        response = self.client.get(self.list_req_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Waiter should be allowed
        self.client.force_authenticate(user=self.waiter)
        response = self.client.get(self.list_req_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_complete_service_request_waiter(self):
        req = ServiceRequest.objects.create(table=self.table, request_type=ServiceRequest.TYPE_WATER)
        complete_url = reverse('complete_service_request', kwargs={'request_id': req.id})

        self.client.force_authenticate(user=self.waiter)
        response = self.client.patch(complete_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, ServiceRequest.STATUS_COMPLETED)
