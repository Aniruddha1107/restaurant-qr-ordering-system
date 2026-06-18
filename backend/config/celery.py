import os
from celery import Celery

# Set default Django settings module for the celery program
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')

# Configure task parameters from settings namespace 'CELERY'
app.config_from_object('django.conf:settings', namespace='CELERY')

# Discover tasks across all registered Django apps
app.autodiscover_tasks()

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
