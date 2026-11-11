from django.contrib.auth.models import User
from django.test import SimpleTestCase
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
