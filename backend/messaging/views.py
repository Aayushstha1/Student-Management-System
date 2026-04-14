from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import models

from .models import ChatThread, ChatMessage, ClassAnnouncement
from .serializers import ChatThreadSerializer, ChatMessageSerializer, ClassAnnouncementSerializer
from students.models import Student
from teachers.models import Teacher


class ChatThreadListCreateView(generics.ListCreateAPIView):
    serializer_class = ChatThreadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            try:
                student = Student.objects.get(user=user)
                return ChatThread.objects.filter(student=student).select_related('student__user', 'teacher__user')
            except Student.DoesNotExist:
                return ChatThread.objects.none()
        if user.role == 'teacher':
            try:
                teacher = Teacher.objects.get(user=user)
                return ChatThread.objects.filter(teacher=teacher).select_related('student__user', 'teacher__user')
            except Teacher.DoesNotExist:
                return ChatThread.objects.none()
        if user.role == 'admin':
            return ChatThread.objects.select_related('student__user', 'teacher__user').all()
        return ChatThread.objects.none()

    def create(self, request, *args, **kwargs):
        user = request.user
        if user.role == 'student':
            teacher_id = request.data.get('teacher_id')
            if not teacher_id:
                return Response({'detail': 'teacher_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                student = Student.objects.get(user=user)
            except Student.DoesNotExist:
                return Response({'detail': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
            teacher = get_object_or_404(Teacher, id=teacher_id)
            thread, _ = ChatThread.objects.get_or_create(student=student, teacher=teacher)
        elif user.role == 'teacher':
            student_id = request.data.get('student_id')
            if not student_id:
                return Response({'detail': 'student_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                teacher = Teacher.objects.get(user=user)
            except Teacher.DoesNotExist:
                return Response({'detail': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
            student = get_object_or_404(Student, id=student_id)
            thread, _ = ChatThread.objects.get_or_create(student=student, teacher=teacher)
        else:
            raise PermissionDenied('Only students and teachers can create chats')

        serializer = self.get_serializer(thread, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ChatMessageListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, thread_id):
        user = request.user
        thread = get_object_or_404(ChatThread, id=thread_id)
        if user.role not in ['student', 'teacher', 'admin']:
            raise PermissionDenied('Not allowed')

        # Ensure participant
        if user.role != 'admin':
            if not (thread.student.user_id == user.id or thread.teacher.user_id == user.id):
                raise PermissionDenied('You are not a participant of this chat')

        qs = ChatMessage.objects.filter(thread=thread).order_by('created_at')

        # Mark messages as read
        ChatMessage.objects.filter(thread=thread, recipient=user, is_read=False).update(
            is_read=True, read_at=timezone.now()
        )

        data = ChatMessageSerializer(qs, many=True).data
        return Response(data)

    def post(self, request, thread_id):
        user = request.user
        thread = get_object_or_404(ChatThread, id=thread_id)

        if user.role not in ['student', 'teacher']:
            raise PermissionDenied('Only students and teachers can send messages')

        if not (thread.student.user_id == user.id or thread.teacher.user_id == user.id):
            raise PermissionDenied('You are not a participant of this chat')

        content = request.data.get('content')
        if not content:
            return Response({'detail': 'content is required'}, status=status.HTTP_400_BAD_REQUEST)

        recipient = thread.teacher.user if thread.student.user_id == user.id else thread.student.user
        msg = ChatMessage.objects.create(
            thread=thread,
            sender=user,
            recipient=recipient,
            content=content
        )
        # Touch thread
        ChatThread.objects.filter(id=thread.id).update(updated_at=timezone.now())
        return Response(ChatMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class ClassAnnouncementListCreateView(generics.ListCreateAPIView):
    serializer_class = ClassAnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            try:
                student = Student.objects.get(user=user)
            except Student.DoesNotExist:
                return ClassAnnouncement.objects.none()
            qs = ClassAnnouncement.objects.filter(target_class=student.current_class)
            if student.current_section:
                qs = qs.filter(models.Q(target_section__isnull=True) | models.Q(target_section='') | models.Q(target_section=student.current_section))
            else:
                qs = qs.filter(models.Q(target_section__isnull=True) | models.Q(target_section=''))
            return qs.order_by('-created_at')
        if user.role == 'teacher':
            return ClassAnnouncement.objects.filter(created_by=user).order_by('-created_at')
        if user.role == 'admin':
            return ClassAnnouncement.objects.all().order_by('-created_at')
        return ClassAnnouncement.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ['teacher', 'admin']:
            raise PermissionDenied('Only teachers and admins can post announcements')
        serializer.save(created_by=user)
