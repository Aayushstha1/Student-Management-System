from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from students.models import Student
from django.db import IntegrityError

User = get_user_model()

SAMPLE_STUDENTS_12A = [
    ("hariram_12A", "hariram_12a@example.com", "Hari", "Ram", "+9779812340111"),
    ("sita_12A", "sita_12a@example.com", "Sita", "KC", "+9779812340122"),
    ("gita_12A", "gita_12a@example.com", "Gita", "Rai", "+9779812340133"),
    ("arun_12A", "arun_12a@example.com", "Arun", "Thapa", "+9779812340144"),
    ("ramesh_12A", "ramesh_12a@example.com", "Ramesh", "Sharma", "+9779812340155"),
    ("suman_12A", "suman_12a@example.com", "Suman", "Adhikari", "+9779812340166"),
    ("binita_12A", "binita_12a@example.com", "Binita", "Rai", "+9779812340177"),
    ("pradeep_12A", "pradeep_12a@example.com", "Pradeep", "Shrestha", "+9779812340188"),
    ("manisha_12A", "manisha_12a@example.com", "Manisha", "Gurung", "+9779812340199"),
    ("kiran_12A", "kiran_12a@example.com", "Kiran", "BK", "+9779812340200"),
]

SAMPLE_STUDENTS_10A = [
    ("aayush_10A", "aayush_10a@example.com", "Aayush", "Shrestha", "+9779812340211"),
    ("prakriti_10A", "prakriti_10a@example.com", "Prakriti", "Sharma", "+9779812340212"),
    ("rojan_10A", "rojan_10a@example.com", "Rojan", "Karki", "+9779812340213"),
    ("nisha_10A", "nisha_10a@example.com", "Nisha", "Thapa", "+9779812340214"),
    ("bikash_10A", "bikash_10a@example.com", "Bikash", "Gurung", "+9779812340215"),
    ("rupa_10A", "rupa_10a@example.com", "Rupa", "Rai", "+9779812340216"),
    ("sagar_10A", "sagar_10a@example.com", "Sagar", "Adhikari", "+9779812340217"),
    ("smriti_10A", "smriti_10a@example.com", "Smriti", "Bhandari", "+9779812340218"),
    ("santosh_10A", "santosh_10a@example.com", "Santosh", "KC", "+9779812340219"),
    ("anisha_10A", "anisha_10a@example.com", "Anisha", "Bhattarai", "+9779812340220"),
]

class Command(BaseCommand):
    help = 'Seed sample students for a class/section'

    def add_arguments(self, parser):
        parser.add_argument('--class-name', type=str, default='12', help='Class name (e.g. 10, 12)')
        parser.add_argument('--section', type=str, default='A', help='Section (e.g. A)')
        parser.add_argument('--start-roll', type=int, default=11, help='Starting roll number')
        parser.add_argument('--count', type=int, default=10, help='How many students to create')
        parser.add_argument('--password', type=str, default='TempPass123!', help='Temporary password for created users')

    def handle(self, *args, **options):
        class_name = (options['class_name'] or '').strip()
        section = (options['section'] or '').strip() or 'A'
        start_roll = options['start_roll']
        count = options['count']
        password = options['password']

        if class_name == '10' and section.upper() == 'A':
            sample_students = SAMPLE_STUDENTS_10A
            dob = '2008-01-01'
        else:
            sample_students = SAMPLE_STUDENTS_12A
            dob = '2006-01-01'

        created = []
        skipped = []
        idx = 0
        for i in range(count):
            if i >= len(sample_students):
                break
            username, email, first_name, last_name, phone = sample_students[i]
            roll = str(start_roll + i)
            # Ensure unique username/email
            base_username = username
            base_email = email
            unique_username = base_username
            suffix = 1
            while User.objects.filter(username=unique_username).exists():
                unique_username = f"{base_username}{suffix}"
                suffix += 1

            unique_email = base_email
            suffix = 1
            while User.objects.filter(email=unique_email).exists():
                local, at, domain = base_email.partition('@')
                unique_email = f"{local}{suffix}@{domain}"
                suffix += 1

            try:
                user = User.objects.create_user(username=unique_username, email=unique_email, password=password, first_name=first_name, last_name=last_name, role='student', phone=phone)
                student = Student.objects.create(
                    user=user,
                    student_id=f"STU{class_name}{start_roll + i:03d}",
                    admission_number=f"ADM{class_name}{start_roll + i:03d}",
                    admission_date='2023-06-01',
                    date_of_birth=dob,
                    gender='M' if (i % 2 == 0) else 'F',
                    blood_group='A+' if (i % 3 == 0) else 'O+',
                    father_name=f"Father_{first_name}",
                    mother_name=f"Mother_{first_name}",
                    guardian_contact=phone,
                    current_class=class_name,
                    current_section=section,
                    roll_number=roll
                )
                created.append((unique_username, unique_email, roll))
            except IntegrityError:
                skipped.append((base_username, base_email))

        self.stdout.write(self.style.SUCCESS(f"Created {len(created)} students."))
        for u, e, r in created:
            self.stdout.write(f" - {u} ({e}) roll: {r}")
        if skipped:
            self.stdout.write(self.style.WARNING(f"Skipped {len(skipped)} entries due to conflicts."))
        self.stdout.write(self.style.NOTICE('Done.'))
