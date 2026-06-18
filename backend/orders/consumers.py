import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class OrderConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.group_name = "orders"
        # Join orders group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Leave orders group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive_json(self, content):
        # Handle custom websocket messages if needed
        pass

    async def order_update(self, event):
        # Broadcast the payload content to client
        await self.send_json(event["content"])
