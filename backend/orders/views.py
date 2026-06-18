from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import Order, OrderItem
from menu.models import Table, MenuItem

class OrderCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        table_id = request.data.get("table_id")
        items_data = request.data.get("items", [])

        if not table_id:
            return Response({"error": "Table ID is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not items_data:
            return Response({"error": "Items list cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            table = Table.objects.get(id=table_id, is_active=True)
        except Table.DoesNotExist:
            return Response({"error": "Active Table not found"}, status=status.HTTP_404_NOT_FOUND)

        # Create Order
        order = Order.objects.create(
            table=table,
            user=request.user,
            status=Order.STATUS_PENDING
        )

        order_items = []
        for item_data in items_data:
            menu_item_id = item_data.get("menu_item_id")
            quantity = item_data.get("quantity", 1)
            notes = item_data.get("notes", "")

            try:
                menu_item = MenuItem.objects.get(id=menu_item_id, is_available=True)
            except MenuItem.DoesNotExist:
                # Clean up order on failure
                order.delete()
                return Response({"error": f"Available MenuItem #{menu_item_id} not found"}, status=status.HTTP_404_NOT_FOUND)

            order_item = OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=quantity,
                price=menu_item.price,
                notes=notes
            )
            order_items.append(order_item)

        return Response({
            "status": "success",
            "message": "Order created successfully",
            "order_id": order.id,
            "table_number": table.number,
            "total_items": len(order_items)
        }, status=status.HTTP_201_CREATED)
