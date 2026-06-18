from django.urls import path
from .views import RawMaterialListView, AdjustStockView

urlpatterns = [
    path('', RawMaterialListView.as_view(), name='list_inventory'),
    path('adjust/', AdjustStockView.as_view(), name='adjust_stock'),
]
