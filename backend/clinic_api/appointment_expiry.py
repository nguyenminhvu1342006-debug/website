"""Expire unarrived appointments strictly after their 30-minute slot ends."""
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import Appointment
from .notifications import notify_appointment


def overdue_filter(now=None):
    cutoff = timezone.localtime(now or timezone.now()) - timedelta(minutes=30)
    return Q(date__lt=cutoff.date()) | Q(date=cutoff.date(), time__lt=cutoff.time())


def expire_appointments(now=None):
    overdue = overdue_filter(now)
    ids = Appointment.objects.filter(overdue, status='Confirmed').values_list('pk', flat=True)
    count = 0
    for pk in ids.iterator(chunk_size=200):
        with transaction.atomic():
            # Conditional write serializes against check-in and rescheduling.
            changed = Appointment.objects.filter(overdue, pk=pk, status='Confirmed').update(status='No-show')
            if changed:
                appointment = Appointment.objects.select_related('doctor').get(pk=pk)
                notify_appointment(appointment, 'no_show')
                count += 1
    return count


class AppointmentExpiryMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/'):
            expire_appointments()
        return self.get_response(request)
