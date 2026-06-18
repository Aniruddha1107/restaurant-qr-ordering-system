from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import RawMaterial, Recipe
from decimal import Decimal

class RawMaterialListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ['chef', 'waiter', 'manager']:
            return Response({"error": "Unauthorized role"}, status=status.HTTP_403_FORBIDDEN)

        materials = RawMaterial.objects.all().order_by('name')
        serialized = []
        for mat in materials:
            is_low_stock = mat.quantity < mat.safety_threshold
            serialized.append({
                "id": mat.id,
                "name": mat.name,
                "quantity": str(mat.quantity),
                "unit": mat.unit,
                "safety_threshold": str(mat.safety_threshold),
                "is_low_stock": is_low_stock
            })

        return Response(serialized, status=status.HTTP_200_OK)

class AdjustStockView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in ['chef', 'manager']:
            return Response({"error": "Unauthorized role"}, status=status.HTTP_403_FORBIDDEN)

        material_id = request.data.get("raw_material_id")
        quantity_change = request.data.get("quantity_change")

        if not material_id or quantity_change is None:
            return Response({"error": "raw_material_id and quantity_change are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            mat = RawMaterial.objects.get(id=material_id)
        except RawMaterial.DoesNotExist:
            return Response({"error": "Raw material not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            change_dec = Decimal(str(quantity_change))
        except ValueError:
            return Response({"error": "Invalid decimal quantity"}, status=status.HTTP_400_BAD_REQUEST)

        mat.quantity += change_dec
        if mat.quantity < 0:
            mat.quantity = Decimal('0.00')
        mat.save()

        is_low_stock = mat.quantity < mat.safety_threshold
        alert_triggered = False

        if is_low_stock:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            channel_layer = get_channel_layer()
            if channel_layer:
                alert_triggered = True
                async_to_sync(channel_layer.group_send)(
                    "orders",
                    {
                        "type": "order_update",
                        "content": {
                            "event_type": "low_stock_alert",
                            "material_name": mat.name,
                            "quantity": str(mat.quantity),
                            "unit": mat.unit,
                            "safety_threshold": str(mat.safety_threshold)
                        }
                    }
                )

        return Response({
            "status": "success",
            "message": "Stock adjusted successfully",
            "raw_material_id": mat.id,
            "name": mat.name,
            "new_quantity": str(mat.quantity),
            "is_low_stock": is_low_stock,
            "alert_triggered": alert_triggered
        }, status=status.HTTP_200_OK)
