from django.urls import path
from . import views

app_name = 'hostel'

urlpatterns = [
    path('', views.HostelListCreateView.as_view(), name='hostel-list-create'),
    path('<int:pk>/', views.HostelDetailView.as_view(), name='hostel-detail'),
    path('rooms/', views.RoomListCreateView.as_view(), name='room-list-create'),
    path('rooms/<int:pk>/', views.RoomDetailView.as_view(), name='room-detail'),
    path('allocations/', views.HostelAllocationListCreateView.as_view(), name='allocation-list-create'),
    path('allocations/<int:pk>/', views.HostelAllocationDetailView.as_view(), name='allocation-detail'),
    path('fees/', views.HostelFeeRecordListCreateView.as_view(), name='fee-list-create'),
    path('fees/<int:pk>/', views.HostelFeeRecordDetailView.as_view(), name='fee-detail'),
    path('maintenance/', views.HostelMaintenanceRequestListCreateView.as_view(), name='maintenance-list-create'),
    path('maintenance/<int:pk>/', views.HostelMaintenanceRequestDetailView.as_view(), name='maintenance-detail'),
    path('requests/', views.HostelRoomRequestListCreateView.as_view(), name='room-request-list-create'),
    path('requests/<int:pk>/', views.HostelRoomRequestDetailView.as_view(), name='room-request-detail'),
    path('leave-requests/', views.HostelLeaveRequestListCreateView.as_view(), name='leave-request-list-create'),
    path('leave-requests/<int:pk>/warden-approve/', views.HostelLeaveWardenApproveView.as_view(), name='leave-request-warden-approve'),
    path('leave-requests/<int:pk>/warden-reject/', views.HostelLeaveWardenRejectView.as_view(), name='leave-request-warden-reject'),
    path('leave-requests/<int:pk>/parent-approve/', views.HostelLeaveParentApproveView.as_view(), name='leave-request-parent-approve'),
    path('leave-requests/<int:pk>/parent-reject/', views.HostelLeaveParentRejectView.as_view(), name='leave-request-parent-reject'),
    path('public/hostels/', views.HostelPublicListView.as_view(), name='hostel-public-list'),
    path('public/rooms/', views.HostelRoomPublicListView.as_view(), name='room-public-list'),
    path('public/allocations/', views.HostelAllocationPublicListView.as_view(), name='allocation-public-list'),
    path('mess-menus/', views.HostelMessMenuListCreateView.as_view(), name='mess-menu-list-create'),
    path('mess-menus/<int:pk>/', views.HostelMessMenuDetailView.as_view(), name='mess-menu-detail'),
]
