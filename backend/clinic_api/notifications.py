from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import NotFound

from .models import Notification


def notify_appointment(appointment, event, previous_doctor_id=None):
    titles = {
        'booked': 'Lịch hẹn mới', 'rescheduled': 'Lịch hẹn đã thay đổi',
        'cancelled': 'Lịch hẹn đã hủy', 'checked_in': 'Bệnh nhân đã check-in',
        'completed': 'Đã hoàn tất khám, bệnh án sẵn sàng',
        'no_show': 'Không đến khám: đã hết khung giờ hẹn',
    }
    recipients = set(User.objects.filter(is_active=True).filter(
        Q(groups__name='Receptionist') | Q(is_superuser=True)
    ).values_list('id', flat=True))
    recipients.add(appointment.patient_id)
    if appointment.doctor.user_id:
        recipients.add(appointment.doctor.user_id)
    if previous_doctor_id:
        recipients.add(previous_doctor_id)
    message = (f'Lịch hẹn #{appointment.pk} · {appointment.date:%d/%m/%Y} '
               f'{appointment.time:%H:%M} · BS. {appointment.doctor.full_name}')
    Notification.objects.bulk_create([
        Notification(recipient_id=pk, appointment=appointment, title=titles[event], message=message)
        for pk in recipients
    ])


class NotificationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(recipient=request.user)
        return Response({
            'unread_count': notifications.filter(is_read=False).count(),
            'results': list(notifications.values('id', 'title', 'message', 'appointment_id',
                                                'is_read', 'created_at')[:50]),
        })

    def post(self, request):
        notifications = Notification.objects.filter(recipient=request.user)
        pk = request.data.get('id')
        if pk is not None:
            if not isinstance(pk, int) or isinstance(pk, bool) or not notifications.filter(pk=pk).exists():
                raise NotFound('Không tìm thấy thông báo.')
            notifications = notifications.filter(pk=pk)
        notifications.update(is_read=True)
        return Response({'message': 'Đã đánh dấu đã đọc.'})
