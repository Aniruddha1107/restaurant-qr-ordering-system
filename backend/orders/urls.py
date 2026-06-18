from django.urls import path
from .views import OrderCreateView, OrderListView, OrderStatusUpdateView

urlpatterns = [
    path('', OrderCreateView.as_view(), name='create_order'),
    path('list/', OrderListView.as_view(), name='list_orders'),
    path('<int:order_id>/status/', OrderStatusUpdateView.as_view(), name='update_order_status'),
]
