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

class OrderListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role in ['chef', 'waiter', 'manager']:
            status_filter = request.query_params.get('status')
            if status_filter:
                orders = Order.objects.filter(status=status_filter)
            else:
                orders = Order.objects.exclude(status__in=[Order.STATUS_SERVED, Order.STATUS_CANCELLED])
        else:
            orders = Order.objects.filter(user=user)
        
        orders = orders.select_related('table', 'user').prefetch_related('items__menu_item').order_by('created_at')
        
        serialized_orders = []
        for order in orders:
            serialized_orders.append({
                "id": order.id,
                "table_id": order.table.id,
                "table_number": order.table.number,
                "user_id": order.user.id if order.user else None,
                "user_mobile": order.user.mobile if order.user else None,
                "status": order.status,
                "created_at": order.created_at.isoformat(),
                "updated_at": order.updated_at.isoformat(),
                "items": [
                    {
                        "id": item.id,
                        "menu_item_id": item.menu_item.id,
                        "menu_item_name": item.menu_item.name,
                        "menu_item_emoji": item.menu_item.emoji or "🍔",
                        "quantity": item.quantity,
                        "price": str(item.price),
                        "notes": item.notes or ""
                    }
                    for item in order.items.all()
                ]
            })
            
        return Response(serialized_orders, status=status.HTTP_200_OK)

class OrderStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, order_id):
        user = request.user
        if user.role not in ['chef', 'waiter', 'manager']:
            return Response({"error": "Unauthorized role"}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
            
        new_status = request.data.get("status")
        if not new_status or new_status not in [c[0] for c in Order.STATUS_CHOICES]:
            return Response({"error": "Invalid or missing status"}, status=status.HTTP_400_BAD_REQUEST)
            
        order.status = new_status
        order.save()
        
        return Response({
            "status": "success",
            "message": f"Order #{order.id} status updated to {new_status}",
            "order_id": order.id,
            "order_status": order.status
        }, status=status.HTTP_200_OK)
