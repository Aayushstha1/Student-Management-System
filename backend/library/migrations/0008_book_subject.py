from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0001_initial'),
        ('library', '0007_book_is_fixed'),
    ]

    operations = [
        migrations.AddField(
            model_name='book',
            name='subject',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='library_books', to='attendance.subject'),
        ),
    ]
