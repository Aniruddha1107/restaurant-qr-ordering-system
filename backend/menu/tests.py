from django.test import TestCase
from menu.models import Restaurant, Table, Category, MenuItem

class MenuModelsTestCase(TestCase):
    def setUp(self):
        self.restaurant = Restaurant.objects.create(
            name="Red Velvet Bistro",
            address="123 Gourmet Lane",
            phone="+1234567890"
        )
        self.table = Table.objects.create(
            restaurant=self.restaurant,
            number="12",
            capacity=4
        )
        self.category = Category.objects.create(
            name="Desserts",
            description="Sweet dishes"
        )
        self.menu_item = MenuItem.objects.create(
            category=self.category,
            name="Red Velvet Pancakes",
            description="Signature buttermilk pancakes",
            price=249.00,
            emoji="🥞"
        )

    def test_restaurant_creation(self):
        self.assertEqual(self.restaurant.name, "Red Velvet Bistro")
        self.assertEqual(str(self.restaurant), "Red Velvet Bistro")

    def test_table_creation(self):
        self.assertEqual(self.table.number, "12")
        self.assertEqual(self.table.capacity, 4)
        self.assertTrue(self.table.is_active)
        self.assertEqual(str(self.table), "Red Velvet Bistro - Table 12")

    def test_category_creation(self):
        self.assertEqual(self.category.name, "Desserts")
        self.assertEqual(str(self.category), "Desserts")

    def test_menu_item_creation(self):
        self.assertEqual(self.menu_item.name, "Red Velvet Pancakes")
        self.assertEqual(self.menu_item.price, 249.00)
        self.assertEqual(self.menu_item.emoji, "🥞")
        self.assertEqual(str(self.menu_item), "Red Velvet Pancakes")
