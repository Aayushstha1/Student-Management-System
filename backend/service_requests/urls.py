from django.urls import path
from . import views

app_name = 'service_requests'

urlpatterns = [
    path('', views.ServiceRequestListCreateView.as_view(), name='service-request-list-create'),
    path('<int:pk>/', views.ServiceRequestDetailView.as_view(), name='service-request-detail'),
    path('<int:pk>/respond/', views.ServiceRequestRespondView.as_view(), name='service-request-respond'),
]
