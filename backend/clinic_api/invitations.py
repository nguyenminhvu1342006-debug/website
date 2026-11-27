import hashlib
import logging
import secrets
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound, Throttled
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .models import AccountInvitation, Patient
from .permissions import IsReceptionist

logger = logging.getLogger(__name__)


def deliver_invitation(pk):
    """Pending rows form a durable outbox. Never hold database locks during SMTP."""
    token = secrets.token_urlsafe(32)
    digest = hashlib.sha256(token.encode()).hexdigest()
    with transaction.atomic():
        invitation = AccountInvitation.objects.select_for_update().select_related('user').get(pk=pk)
        if (invitation.consumed_at or not invitation.user.is_active
                or invitation.user.has_usable_password() or invitation.delivery != 'pending'):
            return invitation.delivery
        invitation.token_digest = digest
        invitation.expires_at = timezone.now() + timedelta(hours=24)
        invitation.delivery = 'sending'
        invitation.attempted_at = timezone.now()
        invitation.save(update_fields=['token_digest', 'expires_at', 'delivery', 'attempted_at'])
        email, username = invitation.email, invitation.user.username
    link = settings.FRONTEND_URL.rstrip('/') + '/set-password?' + urlencode({'invitation': pk, 'token': token})
    try:
        sent = send_mail('Clinic - Thiết lập mật khẩu tài khoản',
                         f'Tài khoản: {username}\nThiết lập mật khẩu tại:\n{link}\n'
                         'Link có hiệu lực 24 giờ và chỉ dùng một lần. Không chia sẻ link này.',
                         settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
        delivery = 'sent' if sent else 'failed'
    except Exception:
        # Avoid logging tokens, SMTP credentials or email bodies.
        logger.warning('Invitation email delivery failed (invitation=%s)', pk)
        delivery = 'failed'
    AccountInvitation.objects.filter(pk=pk, token_digest=digest).update(delivery=delivery)
    return delivery


class InvitationThrottle(AnonRateThrottle):
    rate = '10/min'


class SetInitialPasswordView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [InvitationThrottle]

    @transaction.atomic
    def post(self, request):
        class Payload(serializers.Serializer):
            invitation = serializers.IntegerField(min_value=1, max_value=9223372036854775807)
            token = serializers.CharField(max_length=100, trim_whitespace=False)
            password = serializers.CharField(max_length=128, trim_whitespace=False)
            password_confirm = serializers.CharField(max_length=128, trim_whitespace=False)
        serializer = Payload(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        invitation = AccountInvitation.objects.select_for_update().filter(pk=data['invitation']).first()
        digest = hashlib.sha256(data['token'].encode()).hexdigest()
        if (not invitation or invitation.consumed_at or not invitation.expires_at
                or invitation.expires_at <= timezone.now()
                or not secrets.compare_digest(invitation.token_digest, digest)
                or not invitation.user.is_active or invitation.user.has_usable_password()):
            return Response({'detail': 'Link không hợp lệ, đã sử dụng hoặc hết hạn. Vui lòng liên hệ lễ tân.'}, status=400)
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Mật khẩu xác nhận không khớp.'})
        try:
            validate_password(data['password'], invitation.user)
        except ValidationError as error:
            raise serializers.ValidationError({'password': error.messages})
        invitation.user.set_password(data['password'])
        invitation.user.save(update_fields=['password'])
        invitation.consumed_at = timezone.now()
        invitation.token_digest = ''
        invitation.save(update_fields=['consumed_at', 'token_digest'])
        return Response({'detail': 'Đã thiết lập mật khẩu. Bạn có thể đăng nhập.'})


class ResendInvitationView(APIView):
    permission_classes = [IsReceptionist]

    def post(self, request, pk):
        with transaction.atomic():
            patient = Patient.objects.filter(user_id=pk).first()
            invitation = AccountInvitation.objects.select_for_update().filter(user_id=pk).first()
            if not patient or not invitation or invitation.consumed_at or invitation.user.has_usable_password():
                raise NotFound('Tài khoản không có lời mời đang chờ thiết lập mật khẩu.')
            if not invitation.user.is_active:
                raise NotFound('Tài khoản đã bị khóa.')
            if (invitation.delivery == 'sending' and invitation.attempted_at
                    and invitation.attempted_at > timezone.now() - timedelta(minutes=5)):
                raise Throttled(wait=60, detail='Email đang được gửi. Vui lòng thử lại sau.')
            if invitation.requested_at > timezone.now() - timedelta(seconds=60):
                raise Throttled(wait=60, detail='Vui lòng chờ ít nhất 60 giây giữa các lần gửi.')
            invitation.requested_at = timezone.now()
            invitation.token_digest = ''
            invitation.delivery = 'pending'
            invitation.save(update_fields=['requested_at', 'token_digest', 'delivery'])
        delivery = deliver_invitation(invitation.pk)
        return Response({'delivery': delivery, 'email_demo': settings.EMAIL_BACKEND.endswith('console.EmailBackend')})
