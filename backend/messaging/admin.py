from django.contrib import admin
from .models import ChatThread, ChatMessage, ClassAnnouncement


@admin.register(ChatThread)
class ChatThreadAdmin(admin.ModelAdmin):
    list_display = ('id', 'student', 'teacher', 'updated_at')
    search_fields = ('student__user__first_name', 'student__user__last_name', 'teacher__user__first_name', 'teacher__user__last_name')


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'thread', 'sender', 'recipient', 'created_at', 'is_read')
    search_fields = ('sender__username', 'recipient__username', 'content')
    list_filter = ('is_read', 'created_at')


@admin.register(ClassAnnouncement)
class ClassAnnouncementAdmin(admin.ModelAdmin):
    list_display = ('title', 'target_class', 'target_section', 'created_by', 'created_at')
    search_fields = ('title', 'message', 'target_class', 'target_section', 'created_by__username')

# Register your models here.
