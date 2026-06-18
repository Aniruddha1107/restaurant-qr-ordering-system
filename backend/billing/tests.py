from rest_framework.test import APITestCase
from django.urls import reverse
from rest_framework import status
from django.contrib.auth import get_user_model
from menu.models import Restaurant, Table, Category, MenuItem
from orders.models import Order, OrderItem
from billing.models import Bill

User = get_user_model()

class BillingAPITestCase(APITestCase):
    def setUp(self):
        self.restaurant = Restaurant.objects.create(name="Red Velvet Bistro")
        self.table = Table.objects.create(restaurant=self.restaurant, number="12")
        self.user = User.objects.create_user(username="testuser", mobile="+1234567890", password="password123")
        self.category = Category.objects.create(name="Mains")
        self.menu_item = MenuItem.objects.create(category=self.category, name="Sriracha Burger", price=300.00)
        self.order = Order.objects.create(table=self.table, user=self.user, status=Order.STATUS_PENDING)
        self.order_item = OrderItem.objects.create(order=self.order, menu_item=self.menu_item, quantity=2, price=300.00)
        self.generate_bill_url = reverse('generate_bill', kwargs={'order_id': self.order.id})
        self.invoice_url = reverse('invoice_html', kwargs={'order_id': self.order.id})

    def test_generate_bill(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.generate_bill_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Subtotal: 2 * 300 = 600
        # GST (5%): 30
        # Service Charge (2%): 12
        # Total: 642
        self.assertEqual(float(response.data['subtotal']), 600.0)
        self.assertEqual(float(response.data['gst']), 30.0)
        self.assertEqual(float(response.data['service_charge']), 12.0)
        self.assertEqual(float(response.data['total']), 642.0)
        
        bill = Bill.objects.get(order=self.order)
        self.assertEqual(bill.total, 642.0)

    def test_invoice_html(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.invoice_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(b"RED VELVET BISTRO", response.content)
        self.assertIn(b"Sriracha Burger", response.content)
