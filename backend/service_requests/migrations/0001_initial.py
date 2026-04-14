from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('students', '0008_studentpasswordresetrequest'),
    ]

    operations = [
        migrations.CreateModel(
            name='ServiceRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('request_type', models.CharField(choices=[('book_request', 'Book Request'), ('hostel_room_change', 'Hostel Room Change'), ('transport_change', 'Transport Change'), ('leave_request', 'Leave Request'), ('other', 'Other')], max_length=30)),
                ('title', models.CharField(max_length=150)),
                ('description', models.TextField(blank=True, null=True)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('in_progress', 'In Progress'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('completed', 'Completed')], default='pending', max_length=20)),
                ('assigned_role', models.CharField(choices=[('admin', 'Admin'), ('librarian', 'Librarian'), ('hostel_warden', 'Hostel Warden'), ('accountant', 'Account Section')], default='admin', max_length=20)),
                ('handled_at', models.DateTimeField(blank=True, null=True)),
                ('response_note', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('handled_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='handled_service_requests', to=settings.AUTH_USER_MODEL)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='service_requests', to='students.student')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
