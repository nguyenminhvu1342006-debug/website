from datetime import datetime, timedelta
from unittest.mock import patch
from django.contrib.auth.models import User, Group
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .appointment_expiry import expire_appointments
from .models import Appointment, Doctor, Notification


class AppointmentExpiryTests(TestCase):
    def setUp(self):
        self.now = timezone.make_aware(datetime(2030, 5, 1, 14, 30))
        self.patient = User.objects.create_user('expiry_patient')
        self.doctor = Doctor.objects.create(full_name='Doctor')
        self.appointment = Appointment.objects.create(patient=self.patient, doctor=self.doctor,
                                                      date=self.now.date(), time='14:00')

    def test_exact_boundary_and_idempotency(self):
        self.assertEqual(expire_appointments(self.now - timedelta(seconds=1)), 0)
        self.assertEqual(expire_appointments(self.now), 0)
        self.assertEqual(expire_appointments(self.now + timedelta(seconds=1)), 1)
        self.appointment.refresh_from_db()
        self.assertEqual(self.appointment.status, 'No-show')
        self.assertEqual(expire_appointments(self.now + timedelta(seconds=2)), 0)
        self.assertEqual(Notification.objects.filter(recipient=self.patient).count(), 1)

    def test_preserves_other_statuses_and_future_slots(self):
        for status in ('Checked-in', 'Completed', 'Cancelled', 'No-show'):
            Appointment.objects.create(patient=self.patient, doctor=self.doctor,
                                       date=self.now.date() - timedelta(days=1), time='14:00', status=status)
        self.assertEqual(expire_appointments(self.now), 0)
        self.assertEqual(Appointment.objects.filter(status='Checked-in').count(), 1)
        self.appointment.date -= timedelta(days=1)
        self.appointment.save()
        self.assertEqual(expire_appointments(self.now), 1)

    def test_api_updates_status_and_rejects_late_checkin(self):
        reception = User.objects.create_user('expiry_reception')
        reception.groups.add(Group.objects.create(name='Receptionist'))
        client = APIClient()
        client.force_authenticate(reception)
        with patch('django.utils.timezone.now', return_value=self.now + timedelta(seconds=1)):
            response = client.post(f'/api/reception/appointments/{self.appointment.pk}/', {'action': 'check-in'})
        self.assertEqual(response.status_code, 400)
        self.appointment.refresh_from_db()
        self.assertEqual(self.appointment.status, 'No-show')
