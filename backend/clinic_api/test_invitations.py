import re
from datetime import timedelta
from unittest.mock import patch
from urllib.parse import urlparse, parse_qs

from django.contrib.auth.models import User, Group
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import AccountInvitation, Patient
from .invitations import deliver_invitation


class InvitationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.reception = User.objects.create_user('invite_reception', password='Reception!2026')
        self.reception.groups.add(Group.objects.create(name='Receptionist'))
        self.client = APIClient()
        self.client.force_authenticate(self.reception)
        self.payload = {'username': 'invited', 'email': 'Patient@Example.com', 'full_name': 'Invited Patient'}

    def register(self):
        response = self.client.post('/api/reception/patients/', self.payload)
        self.assertEqual(response.status_code, 201, response.data)
        return response

    def link_payload(self):
        link = re.search(r'https?://\S+', mail.outbox[-1].body).group()
        params = parse_qs(urlparse(link).query)
        return {'invitation': int(params['invitation'][0]), 'token': params['token'][0],
                'password': 'PatientOwnSecret!2026', 'password_confirm': 'PatientOwnSecret!2026'}

    def test_complete_invitation_and_replay_blocked(self):
        self.register()
        user = User.objects.get(username='invited')
        self.assertEqual(user.email, 'patient@example.com')
        self.assertFalse(user.has_usable_password())
        data = self.link_payload()
        self.assertNotEqual(AccountInvitation.objects.get().token_digest, data['token'])
        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid-old-token')
        self.assertEqual(self.client.post('/api/account/set-password/', data).status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password(data['password']))
        self.assertEqual(self.client.post('/api/account/set-password/', data).status_code, 400)
        self.assertEqual(self.client.post('/api/login/', {'username': user.username, 'password': data['password']}).status_code, 200)

    def test_bad_expired_and_mismatched_passwords(self):
        self.register()
        data = self.link_payload()
        url = '/api/account/set-password/'
        self.assertEqual(self.client.post(url, dict(data, token='wrong')).status_code, 400)
        self.assertEqual(self.client.post(url, dict(data, password_confirm='different')).status_code, 400)
        self.assertEqual(self.client.post(url, dict(data, password='123', password_confirm='123')).status_code, 400)
        AccountInvitation.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.client.post(url, data).status_code, 400)
        self.assertFalse(User.objects.get(username='invited').has_usable_password())

    def test_resend_rotates_link_and_enforces_cooldown_and_permissions(self):
        response = self.register()
        old = self.link_payload()
        url = f"/api/reception/patients/{response.data['user_id']}/invitation/"
        self.assertEqual(self.client.post(url).status_code, 429)
        AccountInvitation.objects.update(requested_at=timezone.now() - timedelta(minutes=2))
        self.assertEqual(self.client.post(url).status_code, 200)
        new = self.link_payload()
        self.assertNotEqual(old['token'], new['token'])
        self.assertEqual(self.client.post('/api/account/set-password/', old).status_code, 400)
        self.client.force_authenticate(User.objects.get(username='invited'))
        self.assertEqual(self.client.post(url).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(url).status_code, 401)
        self.assertEqual(self.client.post('/api/account/set-password/', new).status_code, 200)
        self.client.force_authenticate(self.reception)
        self.assertEqual(self.client.post(url).status_code, 404)

    @patch('clinic_api.invitations.send_mail', side_effect=OSError('SMTP unavailable'))
    def test_send_failure_preserves_account_and_can_retry(self, send):
        response = self.register()
        self.assertEqual(response.data['delivery'], 'failed')
        self.assertTrue(Patient.objects.filter(user__username='invited').exists())
        invitation = AccountInvitation.objects.get()
        invitation.attempted_at = timezone.now() - timedelta(minutes=2)
        invitation.save()
        send.side_effect = None
        send.return_value = 1
        call_command('send_account_invitations', retry_failed=True, verbosity=0)
        invitation.refresh_from_db()
        self.assertEqual(invitation.delivery, 'sent')

    def test_email_validation_uniqueness_and_legacy_account(self):
        legacy = User.objects.create_user('legacy', email='LEGACY@example.com', password='LegacySecret!2026')
        self.assertEqual(self.client.post('/api/reception/patients/', dict(self.payload, email='legacy@example.com')).status_code, 400)
        self.assertEqual(self.client.post('/api/reception/patients/', dict(self.payload, email='invalid')).status_code, 400)
        self.register()
        self.assertEqual(self.client.post('/api/reception/patients/', dict(self.payload, username='duplicate', email='PATIENT@example.com')).status_code, 400)
        legacy.refresh_from_db()
        self.assertTrue(legacy.check_password('LegacySecret!2026'))
        self.assertFalse(AccountInvitation.objects.filter(user=legacy).exists())

    def test_pending_outbox_and_inactive_user(self):
        response = self.register()
        user = User.objects.get(pk=response.data['user_id'])
        user.is_active = False
        user.save()
        self.assertEqual(self.client.post('/api/account/set-password/', self.link_payload()).status_code, 400)
        user.is_active = True
        user.save()
        AccountInvitation.objects.update(delivery='pending')
        count = len(mail.outbox)
        call_command('send_account_invitations', verbosity=0)
        self.assertEqual(len(mail.outbox), count + 1)
        deliver_invitation(AccountInvitation.objects.get().pk)
        self.assertEqual(len(mail.outbox), count + 1)
