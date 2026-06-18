from rest_framework.test import APITestCase
from django.urls import reverse
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import RawMaterial

User = get_user_model()

class InventoryAPITestCase(APITestCase):
    def setUp(self):
        self.chef = User.objects.create_user(username="chef", mobile="+2222222222", role="chef", password="password123")
        self.customer = User.objects.create_user(username="customer", mobile="+1111111111", role="customer", password="password123")
        self.material = RawMaterial.objects.create(
            name="Sugar",
            quantity=5.00,
            unit=RawMaterial.UNIT_KG,
            safety_threshold=10.00
        )
        self.list_url = reverse('list_inventory')
        self.adjust_url = reverse('adjust_stock')

    def test_list_inventory_chef(self):
        self.client.force_authenticate(user=self.chef)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], "Sugar")
        self.assertTrue(response.data[0]['is_low_stock'])

    def test_list_inventory_customer_forbidden(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_adjust_stock_chef(self):
        self.client.force_authenticate(user=self.chef)
        payload = {"raw_material_id": self.material.id, "quantity_change": "10.00"}
        response = self.client.post(self.adjust_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.material.refresh_from_db()
        self.assertEqual(self.material.quantity, 15.00)
        self.assertFalse(response.data['is_low_stock'])
