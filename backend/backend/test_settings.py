"""Isolated fast tests; never connect to the local MySQL database."""
import os

os.environ.setdefault('DJANGO_SECRET_KEY', 'isolated-tests-only-secret')
os.environ.setdefault('DB_NAME', 'unused')
os.environ.setdefault('DB_USER', 'unused')
os.environ.setdefault('DB_PASSWORD', 'unused')

from .settings import *  # noqa: E402,F403

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
SECRET_KEY = 'isolated-test-secret-key-at-least-32-characters-long'
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
