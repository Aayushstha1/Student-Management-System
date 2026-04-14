from django.urls import path

from .views import CalendarEventListCreateView, EventPhotoListCreateView, EventPhotoApprovedListView, EventPhotoDetailView, EventPhotoApprovalView, AcademicCalendarView

app_name = 'events'

urlpatterns = [
    path('', CalendarEventListCreateView.as_view(), name='event-list-create'),
    path('academic/', AcademicCalendarView.as_view(), name='academic-calendar'),
    path('gallery/', EventPhotoListCreateView.as_view(), name='event-photo-list-create'),
    path('gallery/approved/', EventPhotoApprovedListView.as_view(), name='event-photo-approved-list'),
    path('gallery/<int:pk>/', EventPhotoDetailView.as_view(), name='event-photo-detail'),
    path('gallery/<int:pk>/approval/', EventPhotoApprovalView.as_view(), name='event-photo-approval'),
]
