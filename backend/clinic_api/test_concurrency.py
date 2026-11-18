from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .booking import BookingSerializer, book
from .models import Appointment, Doctor


class ConcurrentBookingTests(TransactionTestCase):
    def test_two_patients_cannot_book_same_doctor_slot(self):
        if connection.vendor != 'mysql':
            self.skipTest('Requires MySQL row locks; SQLite does not validate this behavior.')
        User = get_user_model()
        patients = [User.objects.create_user(username=f'concurrent_{index}') for index in range(2)]
        doctor = Doctor.objects.create(full_name='Concurrency Doctor')
        serializer = BookingSerializer(data={
            'doctor_id': doctor.pk, 'date': (timezone.localdate() + timedelta(days=1)).isoformat(),
            'time': '09:00:00',
        })
        serializer.is_valid(raise_exception=True)
        barrier = Barrier(2)

        def attempt(patient_id):
            close_old_connections()
            try:
                patient = User.objects.get(pk=patient_id)
                barrier.wait(timeout=10)
                try:
                    book(patient, serializer.validated_data)
                    return 'created'
                except ValidationError:
                    return 'conflict'
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(attempt, [patient.pk for patient in patients]))
        self.assertCountEqual(results, ['created', 'conflict'])
        self.assertEqual(Appointment.objects.count(), 1)
