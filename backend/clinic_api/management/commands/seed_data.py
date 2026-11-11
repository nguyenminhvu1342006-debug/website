"""Create development data without overwriting existing profiles or passwords."""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from clinic_api.models import Doctor, Patient, Specialty


DEMO_PASSWORD = 'ClinicDemo2026!'
DOCTORS = (
    ('dr.jane', 'Jane Doe', 'Ngoại khoa'),
    ('dr.marcus', 'Marcus Reed', 'Nội khoa'),
    ('dr.sofia', 'Sofia Kim', 'Ngoại khoa'),
    ('dr.tran', 'Trần', 'Nội khoa'),
)


class Command(BaseCommand):
    help = 'Create development specialties, doctors and a demo patient; preserve existing data.'

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('Demo data is only available when DEBUG=True.')

        User = get_user_model()
        created_users = []
        created_doctors = 0
        specialties = {
            name: Specialty.objects.get_or_create(name=name)[0]
            for name in ('Nội khoa', 'Ngoại khoa')
        }

        for username, full_name, specialty_name in DOCTORS:
            user = User.objects.filter(username=username).first()
            linked = Doctor.objects.filter(user=user).first() if user else None
            if linked:
                # The account is the stable identity, even if its profile was edited.
                if Patient.objects.filter(user=user).exists():
                    raise CommandError(f'{username} also has a patient profile; resolve manually.')
                continue

            matches = Doctor.objects.filter(
                full_name=full_name, specialization=specialties[specialty_name]
            )
            if matches.count() > 1:
                raise CommandError(f'Ambiguous doctor: {full_name}. No data was committed.')
            existing = matches.first()
            if existing:
                # Do not attach accounts or alter profiles that already exist.
                continue
            if user:
                raise CommandError(f'Account {username} exists without the expected doctor profile.')

            user = User(username=username, first_name=full_name)
            user.set_password(DEMO_PASSWORD)
            user.save()
            Doctor.objects.create(
                user=user, full_name=full_name, specialization=specialties[specialty_name]
            )
            created_users.append(username)
            created_doctors += 1

        patient_user = User.objects.filter(username='demo_patient').first()
        if patient_user:
            if (not Patient.objects.filter(user=patient_user).exists()
                    or Doctor.objects.filter(user=patient_user).exists()):
                raise CommandError('demo_patient exists without an unambiguous patient profile.')
        else:
            patient_user = User(username='demo_patient', first_name='Demo', last_name='Patient')
            patient_user.set_password(DEMO_PASSWORD)
            patient_user.save()
            Patient.objects.create(user=patient_user, full_name='Demo Patient')
            created_users.append('demo_patient')

        self.stdout.write(self.style.SUCCESS(
            f'Seed complete: {created_doctors} doctors and {len(created_users)} accounts created. '
            'Existing data and passwords were preserved.'
        ))
        if created_users:
            self.stdout.write('New accounts: ' + ', '.join(created_users))
            self.stdout.write('Development password for new accounts: ' + DEMO_PASSWORD)
