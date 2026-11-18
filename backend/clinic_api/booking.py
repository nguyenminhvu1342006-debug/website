"""Validated booking operations shared by patients and receptionists."""
from datetime import datetime, time

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError

from .models import Appointment, Doctor

SLOTS = tuple(time(hour, minute) for hour in (9, 10, 11, 13, 14, 15) for minute in (0, 30))
OCCUPIED = ('Confirmed', 'Checked-in', 'Completed')


class SlotQuerySerializer(serializers.Serializer):
    doctor_id = serializers.IntegerField(min_value=1)
    date = serializers.DateField()

    def validate_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError('Không thể chọn ngày trong quá khứ.')
        return value


class BookingSerializer(SlotQuerySerializer):
    time = serializers.TimeField()

    def validate(self, attrs):
        moment = timezone.make_aware(datetime.combine(attrs['date'], attrs['time']))
        if attrs['time'] not in SLOTS:
            raise serializers.ValidationError({'time': 'Khung giờ không hợp lệ.'})
        if moment <= timezone.now():
            raise serializers.ValidationError({'time': 'Giờ khám phải ở tương lai.'})
        return attrs


@transaction.atomic
def book(patient, data, appointment=None):
    # All writers lock the patient then doctor, before checking occupancy.
    # Locking existing parent rows also protects slots which have no booking yet.
    get_user_model().objects.select_for_update().get(pk=patient.pk)
    doctor = Doctor.objects.select_for_update().filter(pk=data['doctor_id']).first()
    if not doctor:
        raise NotFound('Không tìm thấy bác sĩ.')
    if doctor.user_id and not doctor.user.is_active:
        raise ValidationError('Bác sĩ hiện không nhận lịch.')
    qs = Appointment.objects.select_for_update().filter(
        date=data['date'], time=data['time'], status__in=OCCUPIED,
    )
    if appointment:
        appointment = Appointment.objects.select_for_update().get(pk=appointment.pk)
        if appointment.status != 'Confirmed':
            raise ValidationError('Chỉ được đổi lịch chưa check-in.')
        qs = qs.exclude(pk=appointment.pk)
    if qs.filter(doctor=doctor).exists():
        raise ValidationError('Khung giờ của bác sĩ đã được đặt. Vui lòng chọn lại.')
    if qs.filter(patient=patient).exists():
        raise ValidationError('Bệnh nhân đã có lịch vào giờ này.')
    if appointment:
        appointment.doctor = doctor
        appointment.date = data['date']
        appointment.time = data['time']
        appointment.save(update_fields=['doctor', 'date', 'time'])
        return appointment
    return Appointment.objects.create(patient=patient, doctor=doctor,
                                      date=data['date'], time=data['time'])
