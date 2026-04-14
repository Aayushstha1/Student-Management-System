from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('results', '0007_exam_seating'),
    ]

    operations = [
        migrations.DeleteModel(
            name='ExamSeatAssignment',
        ),
        migrations.DeleteModel(
            name='ExamRoom',
        ),
    ]
