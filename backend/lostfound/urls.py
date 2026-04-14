from django.urls import path

from .views import LostFoundItemListCreateView, LostFoundItemDetailView, LostFoundMarkFoundView

urlpatterns = [
    path('items/', LostFoundItemListCreateView.as_view(), name='lostfound-items'),
    path('items/<int:pk>/', LostFoundItemDetailView.as_view(), name='lostfound-item-detail'),
    path('items/<int:pk>/mark-found/', LostFoundMarkFoundView.as_view(), name='lostfound-mark-found'),
]
