from django.db import models
from menu.models import MenuItem

class RawMaterial(models.Model):
    UNIT_KG = 'kg'
    UNIT_G = 'g'
    UNIT_L = 'l'
    UNIT_ML = 'ml'
    UNIT_PCS = 'pcs'

    UNIT_CHOICES = [
        (UNIT_KG, 'Kilograms'),
        (UNIT_G, 'Grams'),
        (UNIT_L, 'Liters'),
        (UNIT_ML, 'Milliliters'),
        (UNIT_PCS, 'Pieces'),
    ]

    name = models.CharField(max_length=100, unique=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default=UNIT_KG)
    safety_threshold = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)

    def __str__(self):
        return f"{self.name} ({self.quantity} {self.unit})"

class Recipe(models.Model):
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='recipes')
    raw_material = models.ForeignKey(RawMaterial, on_delete=models.CASCADE, related_name='recipes')
    quantity_needed = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ('menu_item', 'raw_material')

    def __str__(self):
        return f"{self.menu_item.name} uses {self.quantity_needed} {self.raw_material.unit} of {self.raw_material.name}"
