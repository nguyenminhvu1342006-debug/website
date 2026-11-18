from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Appointment, Doctor, Patient, Specialty

User = get_user_model()


class BookingWorkflowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.patient_user = User.objects.create_user('booking_patient', password='PatientPassword2026!')
        cls.patient = Patient.objects.create(user=cls.patient_user, full_name='Demo Booking')
        cls.other_user = User.objects.create_user('other_patient')
        Patient.objects.create(user=cls.other_user, full_name='Other Patient')
        cls.doctor_user = User.objects.create_user('booking_doctor')
        cls.doctor = Doctor.objects.create(user=cls.doctor_user, full_name='Same Name',
                                           specialization=Specialty.objects.create(name='Nội khoa'))
        cls.other_doctor = Doctor.objects.create(full_name='Same Name')
        cls.reception = User.objects.create_user('reception')
        cls.reception.groups.add(Group.objects.create(name='Receptionist'))

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.patient_user)
        self.day = timezone.localdate() + timedelta(days=1)
        self.payload = {'doctor_id': self.doctor.pk, 'date': self.day.isoformat(), 'time': '09:00:00'}

    def create_booking(self):
        response = self.client.post('/api/book/', self.payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return Appointment.objects.get(pk=response.data['id'])

    def test_booking_uses_id_not_ambiguous_name(self):
        appointment = self.create_booking()
        self.assertEqual(appointment.doctor_id, self.doctor.pk)
        self.assertEqual(appointment.patient_id, self.patient_user.pk)

    def test_duplicate_doctor_and_patient_slots_rejected(self):
        self.create_booking()
        self.client.force_authenticate(self.other_user)
        self.assertEqual(self.client.post('/api/book/', self.payload).status_code, 400)
        self.client.force_authenticate(self.patient_user)
        self.payload['doctor_id'] = self.other_doctor.pk
        self.assertEqual(self.client.post('/api/book/', self.payload).status_code, 400)
        self.assertEqual(Appointment.objects.count(), 1)

    def test_past_dates_invalid_times_and_unknown_doctors(self):
        for changes in ({'date': 'bad-date'}, {'date': (self.day - timedelta(days=2)).isoformat()},
                        {'time': '03:17:00'}, {'time': 'bad'}, {'doctor_id': -1}):
            response = self.client.post('/api/book/', dict(self.payload, **changes))
            self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(self.client.post('/api/book/', dict(self.payload, doctor_id=999999)).status_code, 404)
        self.assertFalse(Appointment.objects.exists())

    def test_slots_validate_queries_and_hide_bookings(self):
        self.create_booking()
        response = self.client.get('/api/slots/', {'doctor_id': self.doctor.pk, 'date': self.day.isoformat()})
        self.assertNotIn('09:00:00', response.data['available_slots'])
        self.assertEqual(self.client.get('/api/slots/', {'doctor_id': self.doctor.pk, 'date': 'invalid'}).status_code, 400)

    def test_reception_filters_by_displayed_patient_code(self):
        appointment = self.create_booking()
        Appointment.objects.create(patient=self.other_user, doctor=self.doctor,
                                   date=self.day, time='10:00:00')
        self.client.force_authenticate(self.reception)
        params = {'date': self.day.isoformat(), 'search': f' a{self.patient_user.pk:07d} '}
        response = self.client.get('/api/reception/appointments/', params)
        self.assertEqual([item['id'] for item in response.data], [appointment.pk])
        # Search must agree with the code displayed when a custom code exists.
        self.patient.patient_id = 'BN-001'
        self.patient.save()
        self.assertEqual(self.client.get('/api/reception/appointments/', params).data, [])
        params['search'] = 'bn-001'
        self.assertEqual(len(self.client.get('/api/reception/appointments/', params).data), 1)
        params['search'] = 'nonexistent-name'
        self.assertEqual(self.client.get('/api/reception/appointments/', params).data, [])
        params = {'date': self.day.isoformat(), 'search': ''}
        self.assertEqual(len(self.client.get('/api/reception/appointments/', params).data), 2)

    def test_patient_lookup_supports_display_id_and_contact_details(self):
        self.client.force_authenticate(self.reception)
        self.patient.phone = '0901234567'
        self.patient.address = 'District 3'
        self.patient.save()
        url = '/api/reception/patients/'
        for search in (f'a{self.patient_user.pk:07d}', 'Demo Booking', 'booking_patient', '0901234567', 'District 3'):
            response = self.client.get(url, {'search': search})
            self.assertEqual([item['user_id'] for item in response.data], [self.patient_user.pk], search)
        self.patient.patient_id = 'BN-LOOKUP'
        self.patient.save()
        self.assertEqual(self.client.get(url, {'search': f'A{self.patient_user.pk:07d}'}).data, [])
        self.assertEqual(len(self.client.get(url, {'search': 'BN-LOOKUP'}).data), 1)
        self.assertEqual(self.client.get(url, {'search': 'no-matching-patient'}).data, [])

    def test_doctor_schedule_can_search_displayed_patient_ids(self):
        appointment = self.create_booking()
        Appointment.objects.create(patient=self.other_user, doctor=self.doctor, date=self.day, time='10:00:00')
        Appointment.objects.create(patient=self.patient_user, doctor=self.other_doctor, date=self.day, time='11:00:00')
        self.client.force_authenticate(self.doctor_user)
        url = '/api/doctor/appointments/'
        params = {'search': f' a{self.patient_user.pk:07d} '}
        self.assertEqual([item['id'] for item in self.client.get(url, params).data], [appointment.pk])
        self.patient.patient_id = 'BN-DOCTOR'
        self.patient.save()
        self.assertEqual(self.client.get(url, params).data, [])
        params['search'] = 'bn-doctor'
        self.assertEqual([item['id'] for item in self.client.get(url, params).data], [appointment.pk])

    def test_completed_slot_remains_occupied(self):
        appointment = self.create_booking()
        appointment.status = 'Completed'
        appointment.save()
        self.assertEqual(self.client.post('/api/book/', self.payload).status_code, 400)

    def test_cancel_releases_slot_and_enforces_ownership(self):
        appointment = self.create_booking()
        self.client.force_authenticate(self.other_user)
        self.assertEqual(self.client.post(f'/api/cancel/{appointment.pk}/').status_code, 404)
        self.client.force_authenticate(self.patient_user)
        self.assertEqual(self.client.post(f'/api/cancel/{appointment.pk}/').status_code, 200)
        self.create_booking()

    def test_check_in_only_today_and_only_receptionist(self):
        appointment = self.create_booking()
        url = f'/api/reception/appointments/{appointment.pk}/'
        self.assertEqual(self.client.post(url, {'action': 'check-in'}).status_code, 403)
        self.client.force_authenticate(self.reception)
        self.assertEqual(self.client.post(url, {'action': 'check-in'}).status_code, 400)
        appointment.date = timezone.localdate()
        appointment.save()
        self.assertEqual(self.client.post(url, {'action': 'check-in'}).status_code, 200)
        self.assertEqual(self.client.post(url, {'action': 'check-in'}).status_code, 400)
        self.client.force_authenticate(self.patient_user)
        self.assertEqual(self.client.post(f'/api/cancel/{appointment.pk}/').status_code, 404)
        response = self.client.get('/api/my-appointments/', {'status': 'Confirmed'})
        self.assertEqual(response.data[0]['status'], 'Checked-in')

    def test_reschedule_preserves_id_and_checks_conflicts(self):
        appointment = self.create_booking()
        self.client.force_authenticate(self.reception)
        url = f'/api/reception/appointments/{appointment.pk}/'
        response = self.client.post(url, dict(self.payload, action='reschedule', time='10:00:00'))
        self.assertEqual(response.status_code, 200, response.data)
        appointment.refresh_from_db()
        self.assertEqual(appointment.time.hour, 10)
        self.assertEqual(Appointment.objects.count(), 1)

    def test_reception_registration_and_booking(self):
        self.client.force_authenticate(self.reception)
        response = self.client.post('/api/reception/patients/', {
            'username': 'new_patient', 'password': 'ClinicGuest!2026',
            'full_name': 'New Patient', 'phone': '0901234567',
        })
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(User.objects.get(username='new_patient').check_password('ClinicGuest!2026'))
        booking = self.client.post('/api/reception/appointments/', dict(self.payload, patient_user_id=response.data['user_id']))
        self.assertEqual(booking.status_code, 201, booking.data)
        self.assertEqual(self.client.post('/api/reception/patients/', {
            'username': 'new_patient', 'password': 'ClinicGuest!2026', 'full_name': 'Duplicated',
        }).status_code, 400)

    def test_role_permissions(self):
        for user in (self.patient_user, self.doctor_user):
            self.client.force_authenticate(user)
            for url in ('/api/reception/patients/', '/api/reception/appointments/', '/api/reception/profile/'):
                self.assertEqual(self.client.get(url).status_code, 403)
        for user in (self.reception, self.doctor_user):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.post('/api/book/', self.payload).status_code, 403)
            self.assertEqual(self.client.get('/api/profile/').status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/reception/patients/').status_code, 401)

    def test_login_ignores_expired_or_invalid_bearer(self):
        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid-expired-token')
        response = self.client.post('/api/login/', {'username': 'booking_patient', 'password': 'PatientPassword2026!'})
        self.assertEqual(response.status_code, 200, response.data)

    def test_doctor_next_appointment_excludes_elapsed_time(self):
        now = timezone.localtime()
        if now.hour == 0:
            self.skipTest('No past slot within today yet.')
        Appointment.objects.create(patient=self.patient_user, doctor=self.doctor,
                                   date=now.date(), time='00:00:00')
        future = self.create_booking()
        self.client.force_authenticate(self.doctor_user)
        response = self.client.get('/api/doctor/dashboard/')
        self.assertEqual(response.data['next_appointment']['id'], future.pk)

    @override_settings(DEBUG=True)
    def test_optional_receptionist_seed_is_idempotent(self):
        call_command('seed_data', include_receptionist=True, stdout=StringIO())
        call_command('seed_data', include_receptionist=True, stdout=StringIO())
        user = User.objects.get(username='demo_reception')
        self.assertTrue(user.groups.filter(name='Receptionist').exists())
        self.assertFalse(user.is_superuser)
