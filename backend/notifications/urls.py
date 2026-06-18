from django.urls import path
from .views import ServiceRequestCreateView, ServiceRequestListView, ServiceRequestCompleteView

urlpatterns = [
    path('request/', ServiceRequestCreateView.as_view(), name='create_service_request'),
    path('list/', ServiceRequestListView.as_view(), name='list_service_requests'),
    path('<int:request_id>/complete/', ServiceRequestCompleteView.as_view(), name='complete_service_request'),
]
