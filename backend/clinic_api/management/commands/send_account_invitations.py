from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from clinic_api.models import AccountInvitation
from clinic_api.invitations import deliver_invitation


class Command(BaseCommand):
    help = 'Send pending account invitations; optionally retry failed deliveries.'

    def add_arguments(self, parser):
        parser.add_argument('--retry-failed', action='store_true')

    def handle(self, *args, **options):
        # Recover a crashed sender after the configured SMTP timeout has elapsed.
        cutoff = timezone.now() - timedelta(minutes=5)
        AccountInvitation.objects.filter(delivery='sending', attempted_at__lt=cutoff,
                                         consumed_at__isnull=True).update(delivery='pending')
        if options['retry_failed']:
            AccountInvitation.objects.filter(delivery='failed', consumed_at__isnull=True,
                                             attempted_at__lt=timezone.now() - timedelta(seconds=60)).update(delivery='pending')
        ids = AccountInvitation.objects.filter(delivery='pending', consumed_at__isnull=True).values_list('pk', flat=True)
        for pk in ids.iterator():
            self.stdout.write(f'Invitation {pk}: {deliver_invitation(pk)}')
