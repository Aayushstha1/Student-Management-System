from django.urls import path
from . import views

urlpatterns = [
    path('schedules/', views.ClassScheduleListCreateView.as_view(), name='class-schedule-list'),
    path('schedules/<int:pk>/', views.ClassScheduleDetailView.as_view(), name='class-schedule-detail'),
    path('conflicts/', views.ClassScheduleConflictView.as_view(), name='class-schedule-conflicts'),
    path('lesson-plans/', views.LessonPlanListCreateView.as_view(), name='lesson-plan-list'),
    path('lesson-plans/<int:pk>/', views.LessonPlanDetailView.as_view(), name='lesson-plan-detail'),
]
