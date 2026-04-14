from django.urls import path
from . import views

urlpatterns = [
    path('threads/', views.ChatThreadListCreateView.as_view(), name='chat-threads'),
    path('threads/<int:thread_id>/messages/', views.ChatMessageListCreateView.as_view(), name='chat-messages'),
    path('announcements/', views.ClassAnnouncementListCreateView.as_view(), name='class-announcements'),
]
