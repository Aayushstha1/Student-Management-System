from django.db import migrations


def purge_behavior_records(apps, schema_editor):
    BehaviorRecord = apps.get_model('students', 'BehaviorRecord')
    BehaviorRecord.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('students', '0011_consentrequest_amount_consentrequest_end_time_and_more'),
    ]

    operations = [
        migrations.RunPython(purge_behavior_records, reverse_code=migrations.RunPython.noop),
        migrations.DeleteModel(
            name='BehaviorRecord',
        ),
    ]
