"""Launch a disposable browser-test backend, independent of local MySQL."""
import os
from pathlib import Path
from uuid import uuid4

os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.e2e_settings'
os.environ['CLINIC_E2E_RUN'] = uuid4().hex
(Path(__file__).resolve().parent.parent / '.test-run').mkdir(exist_ok=True)

import django
django.setup()

from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.utils import timezone
from clinic_api.models import Appointment, Doctor, Patient

call_command('migrate', interactive=False, verbosity=0)
call_command('seed_data', include_receptionist=True)
Appointment.objects.create(
    patient=get_user_model().objects.get(username='demo_patient'),
    doctor=Doctor.objects.get(user__username='dr.jane'),
    date=timezone.localdate(), time='09:00:00',
)
medical_user = get_user_model().objects.create_user('demo_medical', password='ClinicDemo2026!')
Patient.objects.create(user=medical_user, full_name='Medical Browser Patient')
Appointment.objects.create(patient=medical_user, doctor=Doctor.objects.get(user__username='dr.marcus'),
                           date=timezone.localdate(), time='10:00:00')
call_command('runserver', '127.0.0.1:8011', use_reloader=False)
