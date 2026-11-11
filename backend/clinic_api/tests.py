from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase, override_settings
from django.core.management import call_command
from django.core.management.base import CommandError
from io import StringIO
from .models import Doctor, Specialty, Appointment
from .management.commands.seed_data import DEMO_PASSWORD
from .models import Patient
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
