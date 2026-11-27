from datetime import date, time
from django.contrib.auth.models import User, Group
from django.test import TestCase
from django.db import transaction
from rest_framework.test import APIClient
from .models import Appointment, Doctor, Notification
from .notifications import notify_appointment


class NotificationTests(TestCase):
    def setUp(self):
        self.patient = User.objects.create_user('patient')
        self.other = User.objects.create_user('other')
        self.doctor_user = User.objects.create_user('doctor')
        self.reception = User.objects.create_user('reception')
        self.reception.groups.add(Group.objects.create(name='Receptionist'))
        self.doctor = Doctor.objects.create(user=self.doctor_user, full_name='Doctor')
        self.appointment = Appointment.objects.create(patient=self.patient, doctor=self.doctor,
                                                      date=date(2030, 1, 1), time=time(9))
        self.client = APIClient()

    def test_recipients_and_owner_scoped_read(self):
        notify_appointment(self.appointment, 'booked')
        self.assertEqual(set(Notification.objects.values_list('recipient_id', flat=True)),
                         {self.patient.id, self.doctor_user.id, self.reception.id})
        self.client.force_authenticate(self.patient)
        response = self.client.get('/api/notifications/')
        self.assertEqual(response.data['unread_count'], 1)
        foreign = Notification.objects.get(recipient=self.doctor_user)
        self.assertEqual(self.client.post('/api/notifications/', {'id': foreign.id}).status_code, 404)
        self.assertEqual(self.client.post('/api/notifications/', {}, format='json').status_code, 200)
        self.assertEqual(self.client.get('/api/notifications/').data['unread_count'], 0)
        foreign.refresh_from_db()
        self.assertFalse(foreign.is_read)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/notifications/').status_code, 401)

    def test_notifications_roll_back_with_business_transaction(self):
        with self.assertRaises(ValueError):
            with transaction.atomic():
                notify_appointment(self.appointment, 'cancelled')
                raise ValueError('rollback')
        self.assertFalse(Notification.objects.exists())

    def test_patient_cancel_notifies_once(self):
        self.client.force_authenticate(self.patient)
        self.assertEqual(self.client.post(f'/api/cancel/{self.appointment.pk}/').status_code, 200)
        self.assertEqual(Notification.objects.count(), 3)
        self.assertEqual(self.client.post(f'/api/cancel/{self.appointment.pk}/').status_code, 404)
        self.assertEqual(Notification.objects.count(), 3)

    def test_registration_notifies_reception_only_on_success(self):
        self.client.force_authenticate(self.reception)
        payload = {'username': 'registered_patient', 'email': 'registered@example.com', 'full_name': 'New Patient'}
        response = self.client.post('/api/reception/patients/', payload)
        self.assertEqual(response.status_code, 201, response.data)
        notification = Notification.objects.get()
        self.assertEqual(notification.recipient, self.reception)
        self.assertIn(response.data['id'], notification.message)
        self.assertNotIn('token=', notification.message)
        self.assertEqual(self.client.post('/api/reception/patients/', payload).status_code, 400)
        self.assertEqual(Notification.objects.count(), 1)
