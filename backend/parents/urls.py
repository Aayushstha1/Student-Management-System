from django.urls import path
from . import views

urlpatterns = [
    path('profile/', views.ParentProfileView.as_view(), name='parent-profile'),
    path('attendance/', views.ParentAttendanceListView.as_view(), name='parent-attendance'),
    path('attendance/progress/monthly/', views.ParentAttendanceMonthlyProgressView.as_view(), name='parent-attendance-monthly'),
    path('attendance/progress/yearly/', views.ParentAttendanceYearlyProgressView.as_view(), name='parent-attendance-yearly'),
    path('results/', views.ParentResultsListView.as_view(), name='parent-results'),
    path('calendar/', views.ParentCalendarView.as_view(), name='parent-calendar'),
]
