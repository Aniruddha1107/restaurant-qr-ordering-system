from django.urls import path
from .views import OwnerDashboardView, ReceptionistDashboardView, ChefDashboardView

urlpatterns = [
    path('owner/', OwnerDashboardView.as_view(), name='owner-dashboard'),
    path('receptionist/', ReceptionistDashboardView.as_view(), name='receptionist-dashboard'),
    path('chef/', ChefDashboardView.as_view(), name='chef-dashboard'),
]
