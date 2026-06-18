from django.test import TestCase
from django.contrib.auth import get_user_model
from menu.models import Restaurant, Table, Category, MenuItem
from orders.models import Order, OrderItem
from billing.models import Bill

User = get_user_model()

class OrdersBillingTestCase(TestCase):
    def setUp(self):
        self.restaurant = Restaurant.objects.create(name="Red Velvet Bistro")
        self.table = Table.objects.create(restaurant=self.restaurant, number="12")
        self.user = User.objects.create_user(username="testuser", mobile="+1234567890", password="password123")
        self.category = Category.objects.create(name="Mains")
        self.menu_item = MenuItem.objects.create(
            category=self.category,
            name="Sriracha Burger",
            price=349.00
        )
        self.order = Order.objects.create(
            table=self.table,
            user=self.user,
            status=Order.STATUS_PENDING
        )
        self.order_item = OrderItem.objects.create(
            order=self.order,
            menu_item=self.menu_item,
            quantity=2,
            price=349.00
        )

    def test_order_creation(self):
        self.assertEqual(self.order.status, Order.STATUS_PENDING)
        self.assertEqual(self.order.table, self.table)
        self.assertEqual(self.order.user, self.user)
        self.assertEqual(str(self.order), f"Order #{self.order.id} - Table 12 (pending)")

    def test_order_item_creation(self):
        self.assertEqual(self.order_item.quantity, 2)
        self.assertEqual(self.order_item.price, 349.00)
        self.assertEqual(str(self.order_item), f"2x Sriracha Burger for Order #{self.order.id}")

    def test_bill_creation(self):
        subtotal = self.order_item.price * self.order_item.quantity
        gst = subtotal * 0.05
        service_charge = subtotal * 0.02
        total = subtotal + gst + service_charge

        bill = Bill.objects.create(
            order=self.order,
            subtotal=subtotal,
            gst=gst,
            service_charge=service_charge,
            total=total,
            is_paid=False
        )

        self.assertEqual(bill.subtotal, 698.00)
        self.assertEqual(bill.gst, 34.90)
        self.assertEqual(bill.service_charge, 13.96)
        self.assertEqual(bill.total, 746.86)
        self.assertFalse(bill.is_paid)
        self.assertEqual(str(bill), f"Bill for Order #{self.order.id} - Total: ₹746.86 (Unpaid)")


from rest_framework.test import APITestCase
from django.urls import reverse
from rest_framework import status

class OrderCreateAPITestCase(APITestCase):
    def setUp(self):
        self.restaurant = Restaurant.objects.create(name="Red Velvet Bistro")
        self.table = Table.objects.create(restaurant=self.restaurant, number="12")
        self.user = User.objects.create_user(username="testuser", mobile="+1234567890", password="password123")
        self.category = Category.objects.create(name="Mains")
        self.menu_item = MenuItem.objects.create(
            category=self.category,
            name="Sriracha Burger",
            price=349.00
        )
        self.create_order_url = reverse('create_order')

    def test_create_order_authenticated_success(self):
        self.client.force_authenticate(user=self.user)
        payload = {
            "table_id": self.table.id,
            "items": [
                {
                    "menu_item_id": self.menu_item.id,
                    "quantity": 2,
                    "notes": "Extra spicy please"
                }
            ]
        }
        response = self.client.post(self.create_order_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['total_items'], 1)
        self.assertTrue(Order.objects.filter(table=self.table, user=self.user).exists())

    def test_create_order_unauthenticated_fails(self):
        payload = {
            "table_id": self.table.id,
            "items": []
        }
        response = self.client.post(self.create_order_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


from channels.testing import WebsocketCommunicator
from config.asgi import application

class OrderConsumerTestCase(APITestCase):
    async def test_order_consumer_connect(self):
        communicator = WebsocketCommunicator(application, "ws/orders/")
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()


