import time
from django.core.management.base import BaseCommand
from django.db import close_old_connections
from clinic_api.appointment_expiry import expire_appointments


class Command(BaseCommand):
    help = 'Mark unarrived appointments No-show after their 30-minute slot ends.'

    def add_arguments(self, parser):
        parser.add_argument('--watch', action='store_true', help='Check every second until stopped.')

    def handle(self, *args, **options):
        try:
            while True:
                close_old_connections()
                count = expire_appointments()
                if count or not options['watch']:
                    self.stdout.write(f'Updated {count} appointment(s).')
                if not options['watch']:
                    break
                time.sleep(1)
        except KeyboardInterrupt:
            self.stdout.write('Stopped.')
