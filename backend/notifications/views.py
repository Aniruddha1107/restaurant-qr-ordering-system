from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import ServiceRequest
from menu.models import Table

class ServiceRequestCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        table_id = request.data.get("table_id")
        request_type = request.data.get("request_type")

        if not table_id or not request_type:
            return Response({"error": "table_id and request_type are required"}, status=status.HTTP_400_BAD_REQUEST)

        if request_type not in [c[0] for c in ServiceRequest.TYPE_CHOICES]:
            return Response({"error": "Invalid request_type"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            table = Table.objects.get(id=table_id, is_active=True)
        except Table.DoesNotExist:
            return Response({"error": "Active Table not found"}, status=status.HTTP_404_NOT_FOUND)

        service_req = ServiceRequest.objects.create(
            table=table,
            request_type=request_type,
            status=ServiceRequest.STATUS_PENDING
        )

        # Broadcast this notification via WebSocket
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                "orders",
                {
                    "type": "order_update",
                    "content": {
                        "event_type": "service_request",
                        "id": service_req.id,
                        "table_number": table.number,
                        "request_type": service_req.request_type,
                        "request_type_display": service_req.get_request_type_display(),
                        "status": service_req.status,
                        "created_at": service_req.created_at.isoformat()
                    }
                }
            )

        return Response({
            "status": "success",
            "message": "Service request created successfully",
            "request_id": service_req.id
        }, status=status.HTTP_201_CREATED)

class ServiceRequestListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ['waiter', 'chef', 'manager']:
            return Response({"error": "Unauthorized role"}, status=status.HTTP_403_FORBIDDEN)

        requests = ServiceRequest.objects.filter(status=ServiceRequest.STATUS_PENDING).select_related('table').order_by('created_at')
        
        serialized = []
        for r in requests:
            serialized.append({
                "id": r.id,
                "table_id": r.table.id,
                "table_number": r.table.number,
                "request_type": r.request_type,
                "request_type_display": r.get_request_type_display(),
                "status": r.status,
                "created_at": r.created_at.isoformat()
            })

        return Response(serialized, status=status.HTTP_200_OK)

class ServiceRequestCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, request_id):
        user = request.user
        if user.role not in ['waiter', 'chef', 'manager']:
            return Response({"error": "Unauthorized role"}, status=status.HTTP_403_FORBIDDEN)

        try:
            service_req = ServiceRequest.objects.get(id=request_id)
        except ServiceRequest.DoesNotExist:
            return Response({"error": "Service request not found"}, status=status.HTTP_404_NOT_FOUND)

        service_req.status = ServiceRequest.STATUS_COMPLETED
        service_req.save()

        # Broadcast update to websocket
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                "orders",
                {
                    "type": "order_update",
                    "content": {
                        "event_type": "service_request_completed",
                        "id": service_req.id,
                        "status": service_req.status
                    }
                }
            )

        return Response({
            "status": "success",
            "message": "Service request marked completed"
        }, status=status.HTTP_200_OK)
