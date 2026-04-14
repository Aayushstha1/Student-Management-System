from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LostFoundItem
from .serializers import LostFoundItemSerializer


class IsReporterOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if getattr(request.user, 'role', None) == 'admin':
            return True
        return obj.reported_by_id == request.user.id


class LostFoundItemListCreateView(generics.ListCreateAPIView):
    queryset = LostFoundItem.objects.select_related('reported_by', 'found_by').all()
    serializer_class = LostFoundItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user, status='open')


class LostFoundItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = LostFoundItem.objects.select_related('reported_by', 'found_by').all()
    serializer_class = LostFoundItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsReporterOrAdmin]


class LostFoundMarkFoundView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            item = LostFoundItem.objects.get(pk=pk)
        except LostFoundItem.DoesNotExist:
            return Response({'detail': 'Item not found.'}, status=status.HTTP_404_NOT_FOUND)

        if item.status in ['found', 'returned']:
            return Response({'detail': 'Item already marked as found/returned.'}, status=status.HTTP_400_BAD_REQUEST)

        note = (request.data.get('note') or '').strip()
        item.status = 'found'
        item.found_by = request.user
        item.found_note = note
        item.resolved_at = timezone.now()
        item.save(update_fields=['status', 'found_by', 'found_note', 'resolved_at', 'updated_at'])
        serializer = LostFoundItemSerializer(item)
        return Response(serializer.data)

# Create your views here.
