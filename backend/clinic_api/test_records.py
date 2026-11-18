from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Appointment, Doctor, MedicalRecord, Patient, Prescription

User = get_user_model()


class MedicalRecordWorkflowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.patient_user = User.objects.create_user('record_patient')
        cls.patient = Patient.objects.create(user=cls.patient_user, full_name='Record Patient')
        cls.other_patient = User.objects.create_user('other_record_patient')
        cls.doctor_user = User.objects.create_user('record_doctor')
        cls.doctor = Doctor.objects.create(user=cls.doctor_user, full_name='Record Doctor')
        cls.second_doctor_user = User.objects.create_user('second_record_doctor')
        cls.second_doctor = Doctor.objects.create(user=cls.second_doctor_user, full_name='Second Doctor')
        cls.reception = User.objects.create_user('record_reception')
        cls.reception.groups.add(Group.objects.create(name='Receptionist'))
        cls.old_date = timezone.localdate() - timedelta(days=400)
        cls.appointment = Appointment.objects.create(patient=cls.patient_user, doctor=cls.doctor,
            date=cls.old_date, time='09:00:00', status='Completed')
        cls.record = MedicalRecord.objects.create(appointment=cls.appointment, diagnosis='Old diagnosis', notes='Old notes')
        Prescription.objects.create(medical_record=cls.record, medication_name='Demo medication', dosage='Demo dosage')
        cls.waiting = Appointment.objects.create(patient=cls.patient_user, doctor=cls.doctor,
            date=timezone.localdate(), time='10:00:00', status='Checked-in')

    def setUp(self):
        self.client = APIClient()

    def test_patient_can_list_detail_filter_and_read_completed_appointment(self):
        self.client.force_authenticate(self.patient_user)
        response = self.client.get('/api/my-records/')
        self.assertEqual([item['id'] for item in response.data], [self.record.pk])
        detail = self.client.get(f'/api/my-records/{self.record.pk}/')
        self.assertEqual(detail.data['prescriptions'][0]['medication_name'], 'Demo medication')
        self.assertEqual(self.client.get('/api/my-records/', {'search': 'Demo medication'}).data[0]['id'], self.record.pk)
        self.assertEqual(self.client.get('/api/my-records/', {'year': self.old_date.year + 10}).data, [])
        self.assertEqual(self.client.get('/api/my-records/', {'date': self.old_date.isoformat()}).data[0]['id'], self.record.pk)
        apps = self.client.get('/api/my-appointments/', {'status': 'Completed'})
        self.assertEqual(apps.data[0]['medical_record_id'], self.record.pk)

    def test_patient_cannot_read_other_patient_or_write_records(self):
        self.client.force_authenticate(self.other_patient)
        self.assertEqual(self.client.get('/api/my-records/').data, [])
        self.assertEqual(self.client.get('/api/my-records/', {'patient_user_id': self.patient_user.pk}).data, [])
        url = f'/api/my-records/{self.record.pk}/'
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.post('/api/my-records/', {'diagnosis': 'tampered'}).status_code, 405)
        self.assertEqual(self.client.patch(url, {'diagnosis': 'tampered'}).status_code, 405)
        self.assertEqual(self.client.delete(url).status_code, 405)

    def test_medical_search_supports_generated_and_custom_patient_codes(self):
        for user, url in ((self.patient_user, '/api/my-records/'), (self.doctor_user, '/api/doctor/records/')):
            self.client.force_authenticate(user)
            records = self.client.get(url, {'search': f'a{self.patient_user.pk:07d}'}).data
            self.assertEqual([item['id'] for item in records], [self.record.pk])
        self.patient.patient_id = 'BN-RECORD'
        self.patient.save()
        for user, url in ((self.patient_user, '/api/my-records/'), (self.doctor_user, '/api/doctor/records/')):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(url, {'search': f'A{self.patient_user.pk:07d}'}).data, [])
            self.assertEqual(len(self.client.get(url, {'search': 'bn-record'}).data), 1)

    def test_reception_and_anonymous_have_no_medical_access(self):
        for user, expected in ((self.reception, 403), (None, 401)):
            self.client.force_authenticate(user)
            for url in ('/api/my-records/', f'/api/my-records/{self.record.pk}/',
                        '/api/doctor/records/', f'/api/doctor/records/{self.record.pk}/'):
                self.assertEqual(self.client.get(url).status_code, expected)

    def test_doctor_cross_history_requires_checked_in_or_completed_relationship(self):
        self.client.force_authenticate(self.second_doctor_user)
        params = {'patient_user_id': self.patient_user.pk}
        detail = f'/api/doctor/records/{self.record.pk}/'
        for status in ('Cancelled', 'Confirmed', 'Checked-in', 'Completed'):
            Appointment.objects.filter(doctor=self.second_doctor).delete()
            Appointment.objects.create(patient=self.patient_user, doctor=self.second_doctor,
                date=timezone.localdate(), time='11:00:00', status=status)
            expected = 200 if status in ('Checked-in', 'Completed') else 403
            self.assertEqual(self.client.get('/api/doctor/records/', params).status_code, expected)
            self.assertEqual(self.client.get(detail).status_code, expected)
        self.assertEqual(self.client.get('/api/doctor/records/').data, [])

    def test_invalid_filters_return_400_not_500(self):
        for user, url in ((self.patient_user, '/api/my-records/'), (self.doctor_user, '/api/doctor/records/')):
            self.client.force_authenticate(user)
            for params in ({'date': 'invalid'}, {'year': 'invalid'}, {'limit': -1}, {'patient_user_id': 'oops'}):
                self.assertEqual(self.client.get(url, params).status_code, 400)

    def test_incomplete_appointments_not_published(self):
        pending = MedicalRecord.objects.create(appointment=self.waiting, diagnosis='Not finalized')
        self.client.force_authenticate(self.patient_user)
        self.assertEqual(len(self.client.get('/api/my-records/').data), 1)
        self.assertEqual(self.client.get(f'/api/my-records/{pending.pk}/').status_code, 404)

    def test_exam_validation_is_atomic_and_patient_sees_final_result(self):
        self.client.force_authenticate(self.doctor_user)
        url = f'/api/doctor/appointments/{self.waiting.pk}/examine/'
        for payload in ({'diagnosis': '   '}, {'diagnosis': 'Test', 'prescriptions': [{'medication_name': 'Drug', 'dosage': ''}]}):
            self.assertEqual(self.client.post(url, payload, format='json').status_code, 400)
        self.waiting.refresh_from_db()
        self.assertEqual(self.waiting.status, 'Checked-in')
        self.assertFalse(MedicalRecord.objects.filter(appointment=self.waiting).exists())
        payload = {'diagnosis': 'Final result', 'notes': 'Follow-up notes', 'prescriptions': []}
        created = self.client.post(url, payload, format='json')
        self.assertEqual(created.status_code, 201)
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 400)
        self.client.force_authenticate(self.patient_user)
        records = self.client.get('/api/my-records/', {'limit': 1}).data
        self.assertEqual(records[0]['diagnosis'], 'Final result')
        self.assertEqual(records[0]['notes'], 'Follow-up notes')
        self.assertEqual(records[0]['prescriptions'], [])

    def test_future_exam_is_rejected(self):
        self.waiting.date = timezone.localdate() + timedelta(days=1)
        self.waiting.save()
        self.client.force_authenticate(self.doctor_user)
        self.assertEqual(self.client.post(f'/api/doctor/appointments/{self.waiting.pk}/examine/',
                                         {'diagnosis': 'Future'}, format='json').status_code, 400)
