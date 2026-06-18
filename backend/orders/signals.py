from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Order

@receiver(pre_save, sender=Order)
def deduct_recipe_on_prepare(sender, instance, **kwargs):
    if not instance.id:
        return
        
    try:
        old_instance = Order.objects.get(id=instance.id)
    except Order.DoesNotExist:
        return
        
    if old_instance.status != Order.STATUS_PREPARING and instance.status == Order.STATUS_PREPARING:
        from inventory.models import Recipe
        from decimal import Decimal
        
        channel_layer = get_channel_layer()
        
        for item in instance.items.all().select_related('menu_item'):
            recipes = Recipe.objects.filter(menu_item=item.menu_item).select_related('raw_material')
            for recipe in recipes:
                raw_mat = recipe.raw_material
                deduction = recipe.quantity_needed * Decimal(item.quantity)
                raw_mat.quantity -= deduction
                if raw_mat.quantity < 0:
                    raw_mat.quantity = Decimal('0.00')
                raw_mat.save()
                
                if raw_mat.quantity < raw_mat.safety_threshold and channel_layer:
                    async_to_sync(channel_layer.group_send)(
                        "orders",
                        {
                            "type": "order_update",
                            "content": {
                                "event_type": "low_stock_alert",
                                "material_name": raw_mat.name,
                                "quantity": str(raw_mat.quantity),
                                "unit": raw_mat.unit,
                                "safety_threshold": str(raw_mat.safety_threshold)
                            }
                        }
                    )

@receiver(post_save, sender=Order)
def order_status_changed(sender, instance, created, **kwargs):
    channel_layer = get_channel_layer()
    if channel_layer:
        items = []
        for item in instance.items.all():
            items.append({
                "menu_item_name": item.menu_item.name,
                "quantity": item.quantity,
                "notes": item.notes or ""
            })

        payload = {
            "order_id": instance.id,
            "table_number": instance.table.number,
            "status": instance.status,
            "created_at": instance.created_at.isoformat(),
            "updated_at": instance.updated_at.isoformat(),
            "items": items
        }

        # Broadcast the update
        async_to_sync(channel_layer.group_send)(
            "orders",
            {
                "type": "order_update",
                "content": payload
            }
        )
