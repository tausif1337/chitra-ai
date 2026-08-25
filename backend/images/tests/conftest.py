import shutil

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
PASSWORD = "correct-horse-battery"


@pytest.fixture(autouse=True)
def media_root(settings, tmp_path):
    """Keep generated test images out of the real MEDIA_ROOT."""
    settings.MEDIA_ROOT = tmp_path / "media"
    yield settings.MEDIA_ROOT
    shutil.rmtree(settings.MEDIA_ROOT, ignore_errors=True)


@pytest.fixture
def user(db):
    return User.objects.create_user(email="painter@example.com", password=PASSWORD)


@pytest.fixture
def other_user(db):
    return User.objects.create_user(email="stranger@example.com", password=PASSWORD)


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def auth_client(client, user):
    client.force_authenticate(user=user)
    return client
