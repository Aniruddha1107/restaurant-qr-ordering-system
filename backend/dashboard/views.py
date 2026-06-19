from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum
from datetime import date
from orders.models import Order
from inventory.models import RawMaterial
from suppliers.models import Supplier
from .permissions import IsRole

class OwnerDashboardView(APIView):
    permission_classes = [IsRole(['owner'])]

    def get(self, request):
        today = date.today()
        total_sales = Order.objects.filter(created_at__date=today).aggregate(total=Sum('orderitem__price'))['total'] or 0
        inventory = RawMaterial.objects.all().values('name').annotate(total_qty=Sum('quantity'))
        supplier_count = Supplier.objects.count()
        return Response({
            'total_sales_today': total_sales,
            'inventory': list(inventory),
            'supplier_count': supplier_count,
        })

class ReceptionistDashboardView(APIView):
    permission_classes = [IsRole(['receptionist'])]

    def get(self, request):
        occupied = Order.objects.filter(status__in=['preparing', 'ready', 'served']).values('table__number').distinct()
        orders = Order.objects.all().values('id', 'table__number', 'status', 'created_at')
        today = date.today()
        sales_today = Order.objects.filter(created_at__date=today).aggregate(total=Sum('orderitem__price'))['total'] or 0
        inventory = RawMaterial.objects.all().values('name').annotate(total_qty=Sum('quantity'))
        return Response({
            'occupied_tables': list(occupied),
            'orders': list(orders),
            'sales_today': sales_today,
            'inventory': list(inventory),
        })

class ChefDashboardView(APIView):
    permission_classes = [IsRole(['chef'])]

    def get(self, request):
        pending = Order.objects.filter(status='pending').values('id', 'table__number')
        return Response({'pending_orders': list(pending)})

    def post(self, request):
        order_id = request.data.get('order_id')
        action = request.data.get('action')
        if not order_id or action not in ('start', 'complete'):
            return Response({'detail': 'Invalid payload'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        if action == 'start':
            order.status = Order.STATUS_PREPARING
        else:
            order.status = Order.STATUS_READY
        order.save()
        return Response({'detail': f'Order {action}ed'}, status=status.HTTP_200_OK)

