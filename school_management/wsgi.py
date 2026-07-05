"""
WSGI config for school_management project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/

gunicorn usage (single worker required by MiniMax semaphore gating):
    gunicorn school_management.wsgi:application --workers 1 --bind 0.0.0.0:8000

    Using more than 1 worker defeats the threading.Semaphore(5) concurrency
    limit in ai_minimax_client — each worker maintains its own semaphore.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'school_management.settings')

application = get_wsgi_application()
