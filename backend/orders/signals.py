from django.db.models.signals import post_save
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Order

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
