from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('library', '0006_book_class_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='book',
            name='is_fixed',
            field=models.BooleanField(default=False),
        ),
    ]
