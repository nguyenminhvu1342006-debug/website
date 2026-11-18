"""Reception extensions used by the receptionist UI (UC-08, UC-09, UC-10, Staff Profile)."""
from datetime import time, timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Appointment, Doctor, Patient, Receptionist, Specialty

User = get_user_model()


class ReceptionExtensionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.reception = User.objects.create_user('reception', first_name='Johny', last_name='Nguyen')
        cls.reception.groups.add(Group.objects.create(name='Receptionist'))
        specialty = Specialty.objects.create(name='Nội khoa')
        cls.doctor = Doctor.objects.create(full_name='Jane Doe', specialization=specialty)
        cls.other_doctor = Doctor.objects.create(full_name='Marcus Reed')
        cls.patients = []
        for index, phone in enumerate(('0901000001', '0901000002', '0901000003')):
            user = User.objects.create_user(f'p{index}')
            cls.patients.append(Patient.objects.create(user=user, full_name=f'Patient {index}', phone=phone))

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.reception)
        self.today = timezone.localdate()

    def make(self, patient, day, hour, status='Confirmed', doctor=None):
        return Appointment.objects.create(patient=patient.user, doctor=doctor or self.doctor,
                                          date=day, time=time(hour, 0), status=status)

    def check_in(self, appointment):
        return self.client.post(f'/api/reception/appointments/{appointment.pk}/', {'action': 'check-in'})

    def test_check_in_assigns_queue_numbers_per_doctor(self):
        first = self.make(self.patients[0], self.today, 9)
        second = self.make(self.patients[1], self.today, 10)
        other = self.make(self.patients[2], self.today, 9, doctor=self.other_doctor)
        self.assertEqual(self.check_in(second).data['queue_number'], 1)
        self.assertEqual(self.check_in(first).data['queue_number'], 2)
        self.assertEqual(self.check_in(other).data['queue_number'], 1)
        response = self.check_in(first)
        self.assertEqual(response.status_code, 400)
        self.assertIn('Không tìm thấy lịch hẹn hợp lệ', str(response.data))
        listed = self.client.get('/api/reception/appointments/').data
        self.assertEqual({row['id']: row['queue_number'] for row in listed},
                         {first.pk: 2, second.pk: 1, other.pk: 1})

    def test_list_supports_range_status_order_and_appointment_code(self):
        yesterday = self.make(self.patients[0], self.today - timedelta(days=1), 9, status='Completed')
        today = self.make(self.patients[1], self.today, 9)
        tomorrow = self.make(self.patients[2], self.today + timedelta(days=1), 9)
        upcoming = self.client.get('/api/reception/appointments/', {
            'date_from': self.today.isoformat(), 'status': 'Confirmed'})
        self.assertEqual([row['id'] for row in upcoming.data], [today.pk, tomorrow.pk])
        self.assertEqual(upcoming.data[0]['doctor_specialty'], 'Nội khoa')
        done = self.client.get('/api/reception/appointments/', {
            'date_to': self.today.isoformat(), 'status': 'Checked-in,Completed', 'order': 'desc'})
        self.assertEqual([row['id'] for row in done.data], [yesterday.pk])
        by_code = self.client.get('/api/reception/appointments/', {
            'date_from': '2000-01-01', 'search': f'#{tomorrow.pk}'})
        self.assertEqual([row['id'] for row in by_code.data], [tomorrow.pk])
        self.assertEqual(self.client.get('/api/reception/appointments/', {'status': 'Bogus'}).status_code, 400)
        # Không truyền khoảng ngày -> giữ hành vi cũ: lịch của hôm nay
        self.assertEqual([row['id'] for row in self.client.get('/api/reception/appointments/').data], [today.pk])

    def test_register_defaults_username_to_phone_and_generates_password(self):
        response = self.client.post('/api/reception/patients/', {
            'full_name': 'Nguyen Van A', 'phone': '+84 902 123 456', 'date_of_birth': '2001-01-01',
            'address': '12 Ly Thuong Kiet', 'blood_type': 'A+', 'known_allergies': 'Penicillin',
            'emergency_contact_name': 'Le Thi Mai', 'emergency_contact_phone': '+84 902 987 654',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['username'], '0902123456')
        password = response.data['initial_password']
        self.assertGreaterEqual(len(password), 10)
        user = User.objects.get(username='0902123456')
        self.assertTrue(user.check_password(password))
        self.assertEqual(user.get_full_name(), 'Nguyen Van A')
        patient = user.patient_profile
        self.assertEqual((patient.blood_type, patient.known_allergies, patient.emergency_contact_name),
                         ('A+', 'Penicillin', 'Le Thi Mai'))
        self.assertEqual(response.data['id'], f'A{user.pk:07d}')

    def test_register_rejects_duplicate_phone_and_points_to_existing_record(self):
        response = self.client.post('/api/reception/patients/', {
            'full_name': 'Someone', 'phone': '090 100 0002'}, format='json')
        self.assertEqual(response.status_code, 400)
        # DRF trả các giá trị lỗi dưới dạng chuỗi
        self.assertEqual(response.data['existing_patient']['user_id'], str(self.patients[1].user_id))
        # SĐT lưu có định dạng (+84, khoảng trắng) vẫn phải được nhận ra là trùng
        formatted = self.client.post('/api/reception/patients/', {
            'full_name': 'Formatted', 'phone': '+84 912 000 111'}, format='json')
        self.assertEqual(formatted.status_code, 201, formatted.data)
        again = self.client.post('/api/reception/patients/', {
            'full_name': 'Again', 'phone': '0912-000-111'}, format='json')
        self.assertEqual(again.status_code, 400)
        self.assertEqual(again.data['existing_patient']['full_name'], 'Formatted')
        missing = self.client.post('/api/reception/patients/', {'full_name': 'No phone'}, format='json')
        self.assertIn('phone', missing.data)
        weak = self.client.post('/api/reception/patients/', {
            'full_name': 'Weak', 'phone': '0911222333', 'password': '12345678'}, format='json')
        self.assertIn('password', weak.data)
        self.assertFalse(User.objects.filter(username='0911222333').exists())

    def test_staff_profile_work_details(self):
        response = self.client.get('/api/reception/profile/')
        self.assertEqual(response.data['full_name'], 'Johny Nguyen')
        self.assertEqual(response.data['position'], 'Front Desk Receptionist')
        self.assertTrue(response.data['staff_code'].startswith('REP-'))
        self.assertFalse(Receptionist.objects.exists())  # GET không tự tạo bản ghi
        updated = self.client.put('/api/reception/profile/', {
            'full_name': 'Johny Nguyen', 'email': 'johny.nguyen@clinic.com', 'phone': '+84 902 656 456',
            'assigned_counter': 'Desk 01', 'current_shift': 'Morning Shift (07:30 - 15:30)',
            'staff_code': 'HACKED',
        }, format='json')
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data['assigned_counter'], 'Desk 01')
        self.assertNotEqual(updated.data['staff_code'], 'HACKED')
        self.reception.refresh_from_db()
        self.assertEqual(self.reception.email, 'johny.nguyen@clinic.com')
        self.assertEqual(self.client.put('/api/reception/profile/', {'full_name': ''}).status_code, 400)
