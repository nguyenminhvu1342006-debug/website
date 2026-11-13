from datetime import date, time, timedelta
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .management.commands.seed_data import DEMO_PASSWORD
from .models import Appointment, Doctor, MedicalRecord, Patient, Prescription, Specialty
from .serializers import PatientProfileSerializer

class PatientProfileSerializerTests(SimpleTestCase):
    def test_profile_uses_patient_fields(self):
        patient = Patient(user=User(id=7), full_name='Nguyen An',
                          phone='0901234567', known_allergies='Peanuts')
        data = PatientProfileSerializer(patient).data
        self.assertEqual(data['phone'], '0901234567')
        self.assertEqual(data['allergies'], 'Peanuts')
        self.assertEqual(data['avatar_initials'], 'NA')
        self.assertIsNone(data['date_of_birth'])
        self.assertEqual(data['id'], 'A0000007')

    def test_allergies_map_to_patient_field(self):
        serializer = PatientProfileSerializer(data={'allergies': 'Peanuts'}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['known_allergies'], 'Peanuts')

    def test_invalid_input_is_rejected(self):
        serializer = PatientProfileSerializer(data={
            'date_of_birth': 'invalid', 'phone': '1' * 21,
        }, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn('date_of_birth', serializer.errors)
        self.assertIn('phone', serializer.errors)


@override_settings(DEBUG=True)
class SeedDataTests(TestCase):
    def seed(self):
        call_command('seed_data', stdout=StringIO())

    def test_creates_expected_data_and_login(self):
        self.seed()
        self.assertEqual(Specialty.objects.count(), 2)
        self.assertEqual(Doctor.objects.count(), 4)
        self.assertEqual(Patient.objects.count(), 1)
        self.assertEqual(Appointment.objects.count(), 0)
        self.assertEqual(User.objects.count(), 5)
        self.assertTrue(self.client.login(username='demo_patient', password=DEMO_PASSWORD))
        self.assertFalse(User.objects.filter(is_staff=True).exists())
        self.assertFalse(User.objects.filter(is_superuser=True).exists())

    def test_rerun_preserves_edited_data_and_password(self):
        self.seed()
        doctor = Doctor.objects.get(user__username='dr.jane')
        doctor.full_name = 'Edited name'
        doctor.save()
        patient = Patient.objects.get(user__username='demo_patient')
        patient.phone = '0901234567'
        patient.save()
        user = patient.user
        user.set_password('ChangedPassword123!')
        user.save()
        self.seed()
        doctor.refresh_from_db()
        patient.refresh_from_db()
        user.refresh_from_db()
        self.assertEqual(doctor.full_name, 'Edited name')
        self.assertEqual(patient.phone, '0901234567')
        self.assertTrue(user.check_password('ChangedPassword123!'))
        self.assertEqual(User.objects.count(), 5)
        self.assertEqual(Doctor.objects.count(), 4)

    def test_existing_unlinked_doctor_is_preserved(self):
        specialty = Specialty.objects.create(name='Ngoại khoa')
        doctor = Doctor.objects.create(full_name='Jane Doe', specialization=specialty)
        self.seed()
        doctor.refresh_from_db()
        self.assertIsNone(doctor.user_id)
        self.assertEqual(Doctor.objects.count(), 4)
        self.assertFalse(User.objects.filter(username='dr.jane').exists())

    def test_ambiguous_doctors_roll_back_seed(self):
        specialty = Specialty.objects.create(name='Ngoại khoa')
        for _ in range(2):
            Doctor.objects.create(full_name='Jane Doe', specialization=specialty)
        with self.assertRaises(CommandError):
            self.seed()
        self.assertEqual(Specialty.objects.count(), 1)
        self.assertEqual(User.objects.count(), 0)

    def test_account_collision_rolls_back_seed(self):
        User.objects.create_user(username='demo_patient', password='ExistingPassword123!')
        with self.assertRaises(CommandError):
            self.seed()
        self.assertEqual(Doctor.objects.count(), 0)
        self.assertEqual(Specialty.objects.count(), 0)
        self.assertEqual(User.objects.count(), 1)

    @override_settings(DEBUG=False)
    def test_disabled_outside_development(self):
        with self.assertRaises(CommandError):
            self.seed()
        self.assertEqual(User.objects.count(), 0)


class DoctorUseCaseTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.specialty = Specialty.objects.create(name='Nội khoa')

        self.doctor_user = User.objects.create_user(
            username='dr.test', password=DEMO_PASSWORD, first_name='Jane', last_name='Doe'
        )
        self.doctor = Doctor.objects.create(
            user=self.doctor_user,
            full_name='Jane Doe',
            specialization=self.specialty,
            phone='0909000111',
            education='ĐH Y Dược',
        )

        self.other_doctor_user = User.objects.create_user(
            username='dr.other', password=DEMO_PASSWORD
        )
        self.other_doctor = Doctor.objects.create(
            user=self.other_doctor_user,
            full_name='Marcus Reed',
            specialization=self.specialty,
        )

        self.patient_user = User.objects.create_user(
            username='patient.test', password=DEMO_PASSWORD, first_name='Nguyen', last_name='An'
        )
        self.patient = Patient.objects.create(
            user=self.patient_user,
            patient_id='BN001',
            full_name='Nguyen Van An',
            phone='0912345678',
            blood_type='O+',
            known_allergies='Penicillin',
        )

        self.today = timezone.localtime().date()
        self.checked_in_app = Appointment.objects.create(
            patient=self.patient_user,
            doctor=self.doctor,
            date=self.today,
            time=time(9, 0),
            status='Checked-in',
        )
        self.confirmed_app = Appointment.objects.create(
            patient=self.patient_user,
            doctor=self.doctor,
            date=self.today,
            time=time(10, 0),
            status='Confirmed',
        )
        self.other_doctor_app = Appointment.objects.create(
            patient=self.patient_user,
            doctor=self.other_doctor,
            date=self.today + timedelta(days=1),
            time=time(9, 30),
            status='Checked-in',
        )

    def _auth_as(self, user):
        self.client.force_authenticate(user=user)

    def test_login_returns_role_and_blocks_inactive_user(self):
        res_doc = self.client.post('/api/login/', {
            'username': 'dr.test',
            'password': DEMO_PASSWORD,
        }, format='json')
        self.assertEqual(res_doc.status_code, 200)
        self.assertEqual(res_doc.data['role'], 'doctor')
        self.assertIn('access', res_doc.data)

        res_pat = self.client.post('/api/login/', {
            'username': 'patient.test',
            'password': DEMO_PASSWORD,
        }, format='json')
        self.assertEqual(res_pat.status_code, 200)
        self.assertEqual(res_pat.data['role'], 'patient')

        self.doctor_user.is_active = False
        self.doctor_user.save()
        res_locked = self.client.post('/api/login/', {
            'username': 'dr.test',
            'password': DEMO_PASSWORD,
        }, format='json')
        self.assertEqual(res_locked.status_code, 403)

    def test_doctor_endpoints_forbid_patient(self):
        self._auth_as(self.patient_user)
        for url in (
            '/api/doctor/dashboard/',
            '/api/doctor/appointments/',
            '/api/doctor/records/',
            '/api/doctor/profile/',
        ):
            res = self.client.get(url)
            self.assertEqual(res.status_code, 403, f'Expected 403 on {url}')

    def test_doctor_dashboard_and_schedule_isolation(self):
        self._auth_as(self.doctor_user)
        dash = self.client.get('/api/doctor/dashboard/')
        self.assertEqual(dash.status_code, 200)
        self.assertEqual(dash.data['stats']['today_total'], 2)
        self.assertEqual(dash.data['stats']['today_waiting'], 1)
        self.assertEqual(dash.data['stats']['today_confirmed'], 1)
        self.assertEqual(dash.data['next_appointment']['id'], self.checked_in_app.id)

        sched = self.client.get('/api/doctor/appointments/', {'range': 'today'})
        self.assertEqual(sched.status_code, 200)
        returned_ids = {item['id'] for item in sched.data}
        self.assertEqual(returned_ids, {self.checked_in_app.id, self.confirmed_app.id})
        self.assertNotIn(self.other_doctor_app.id, returned_ids)

    def test_examine_requires_checked_in_and_creates_record_and_prescriptions(self):
        self._auth_as(self.doctor_user)

        # Confirmed appointment (chưa check-in) phải bị từ chối
        res_confirmed = self.client.post(
            f'/api/doctor/appointments/{self.confirmed_app.id}/examine/',
            {'diagnosis': 'Cảm cúm', 'notes': 'Nghỉ ngơi', 'prescriptions': []},
            format='json',
        )
        self.assertEqual(res_confirmed.status_code, 400)

        # Checked-in appointment khám thành công
        payload = {
            'diagnosis': 'Viêm họng cấp',
            'notes': 'Uống nhiều nước ấm, tái khám sau 5 ngày',
            'prescriptions': [
                {'medication_name': 'Paracetamol 500mg', 'dosage': '1 viên x 3 lần/ngày', 'instructions': 'Sau ăn'},
                {'medication_name': 'Vitamin C', 'dosage': '1 viên/ngày', 'instructions': 'Buổi sáng'},
            ],
        }
        res_ok = self.client.post(
            f'/api/doctor/appointments/{self.checked_in_app.id}/examine/',
            payload,
            format='json',
        )
        self.assertEqual(res_ok.status_code, 201)
        self.checked_in_app.refresh_from_db()
        self.assertEqual(self.checked_in_app.status, 'Completed')
        self.assertEqual(MedicalRecord.objects.count(), 1)
        self.assertEqual(Prescription.objects.count(), 2)

        # Khám lại lần 2 trên lịch Completed bị từ chối
        res_dup = self.client.post(
            f'/api/doctor/appointments/{self.checked_in_app.id}/examine/',
            payload,
            format='json',
        )
        self.assertEqual(res_dup.status_code, 400)

    def test_doctor_cannot_examine_other_doctor_appointment(self):
        self._auth_as(self.doctor_user)
        res = self.client.post(
            f'/api/doctor/appointments/{self.other_doctor_app.id}/examine/',
            {'diagnosis': 'Test', 'prescriptions': []},
            format='json',
        )
        self.assertEqual(res.status_code, 404)

    def test_medical_record_list_and_detail(self):
        record = MedicalRecord.objects.create(
            appointment=self.checked_in_app,
            diagnosis='Đau dạ dày',
            notes='Kiêng đồ cay',
        )
        Prescription.objects.create(
            medical_record=record,
            medication_name='Omeprazole 20mg',
            dosage='1 viên trước ăn sáng',
            instructions='Trong 14 ngày',
        )
        self.checked_in_app.status = 'Completed'
        self.checked_in_app.save()

        self._auth_as(self.doctor_user)
        list_res = self.client.get('/api/doctor/records/', {'patient_user_id': self.patient_user.id})
        self.assertEqual(list_res.status_code, 200)
        self.assertEqual(len(list_res.data), 1)
        self.assertEqual(list_res.data[0]['diagnosis'], 'Đau dạ dày')
        self.assertEqual(len(list_res.data[0]['prescriptions']), 1)

        detail_res = self.client.get(f'/api/doctor/records/{record.id}/')
        self.assertEqual(detail_res.status_code, 200)
        self.assertEqual(detail_res.data['patient']['known_allergies'], 'Penicillin')

    def test_doctor_profile_get_and_update(self):
        self._auth_as(self.doctor_user)
        get_res = self.client.get('/api/doctor/profile/')
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.data['specialization_name'], 'Nội khoa')

        put_res = self.client.put('/api/doctor/profile/', {
            'full_name': 'Jane Marie Doe',
            'phone': '0988777666',
            'education': 'Tiến sĩ Y khoa',
            'certificate': 'CCHN-9999',
        }, format='json')
        self.assertEqual(put_res.status_code, 200)
        self.doctor.refresh_from_db()
        self.assertEqual(self.doctor.full_name, 'Jane Marie Doe')
        self.assertEqual(self.doctor.certificate, 'CCHN-9999')
