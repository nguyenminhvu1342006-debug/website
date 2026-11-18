"""Browser tests use a disposable SQLite file, never the development MySQL DB."""
from .test_settings import *  # noqa: F403
from pathlib import Path
import os

DEBUG = True
ALLOWED_HOSTS = ['127.0.0.1', 'localhost']
CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:4174']
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3',
                        'NAME': Path(__file__).resolve().parents[2] / '.test-run' / (os.environ['CLINIC_E2E_RUN'] + '.sqlite3')}}
