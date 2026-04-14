from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import F
from .models import NoteCategory, Note, NoteRating, NoteBookmark, NoteComment, NoteView
from .serializers import NoteCategorySerializer, NoteSerializer, NoteRatingSerializer, NoteBookmarkSerializer, NoteCommentSerializer, NoteViewSerializer
from students.models import Student


class NoteCategoryListCreateView(generics.ListCreateAPIView):
    queryset = NoteCategory.objects.all()
    serializer_class = NoteCategorySerializer
    permission_classes = [permissions.IsAuthenticated]


class NoteCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = NoteCategory.objects.all()
    serializer_class = NoteCategorySerializer
    permission_classes = [permissions.IsAuthenticated]


class NoteListCreateView(generics.ListCreateAPIView):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ['teacher', 'admin']:
            raise PermissionDenied('Only teachers and admins can upload notes')

        content = serializer.validated_data.get('content')
        if not content:
            title = serializer.validated_data.get('title') or 'Note'
            serializer.save(uploaded_by=user, content=title)
        else:
            serializer.save(uploaded_by=user)


class NoteDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]


class NoteDownloadView(generics.RetrieveAPIView):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]


class NoteRatingView(generics.ListCreateAPIView):
    queryset = NoteRating.objects.all()
    serializer_class = NoteRatingSerializer
    permission_classes = [permissions.IsAuthenticated]


class NoteBookmarkView(generics.ListCreateAPIView):
    queryset = NoteBookmark.objects.all()
    serializer_class = NoteBookmarkSerializer
    permission_classes = [permissions.IsAuthenticated]


class NoteCommentListCreateView(generics.ListCreateAPIView):
    queryset = NoteComment.objects.all()
    serializer_class = NoteCommentSerializer
    permission_classes = [permissions.IsAuthenticated]


class NoteViewListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        note = get_object_or_404(Note, pk=pk)
        user = request.user

        if user.role not in ['teacher', 'admin']:
            raise PermissionDenied('Only teachers and admins can view note views')

        if user.role == 'teacher' and note.uploaded_by != user:
            raise PermissionDenied('You can only view views for your notes')

        qs = NoteView.objects.filter(note=note).select_related('student', 'student__user').order_by('-last_viewed_at')
        return Response(NoteViewSerializer(qs, many=True).data)

    def post(self, request, pk):
        user = request.user
        if user.role != 'student':
            raise PermissionDenied('Only students can record note views')

        try:
            student = Student.objects.get(user=user)
        except Student.DoesNotExist:
            return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

        note = get_object_or_404(Note, pk=pk)

        view, created = NoteView.objects.get_or_create(
            note=note,
            student=student,
            defaults={'view_count': 1}
        )

        if not created:
            NoteView.objects.filter(pk=view.id).update(
                view_count=F('view_count') + 1,
                last_viewed_at=timezone.now()
            )
            view.refresh_from_db()

        Note.objects.filter(pk=note.id).update(view_count=F('view_count') + 1)

        return Response(NoteViewSerializer(view).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
