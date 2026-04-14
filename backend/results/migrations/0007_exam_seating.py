from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('results', '0006_exam_end_time_exam_start_time'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('students', '0008_studentpasswordresetrequest'),
    ]

    operations = [
        migrations.CreateModel(
            name='ExamRoom',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('capacity', models.PositiveIntegerField()),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='ExamSeatAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('seat_number', models.PositiveIntegerField()),
                ('assigned_at', models.DateTimeField(auto_now_add=True)),
                ('assigned_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='exam_seat_assignments', to=settings.AUTH_USER_MODEL)),
                ('exam', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='seat_assignments', to='results.exam')),
                ('room', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='seat_assignments', to='results.examroom')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='exam_seat_assignments', to='students.student')),
            ],
            options={
                'ordering': ['room__name', 'seat_number'],
                'unique_together': {('exam', 'student'), ('exam', 'room', 'seat_number')},
            },
        ),
    ]
