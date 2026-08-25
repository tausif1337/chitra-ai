"""Test settings: fast hashing, stub provider, throttles out of the way."""

from .base import *  # noqa: F401,F403

DEBUG = False
ALLOWED_HOSTS = ["testserver", "localhost"]

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

IMAGE_PROVIDER = "stub"
IMAGE_STORAGE = "local"

AUTH_COOKIE_SECURE = False
AUTH_COOKIE_SAMESITE = "Lax"

REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": {  # noqa: F405
    "anon": "1000/hour",
    "user": "1000/hour",
    "generation": "1000/hour",
}}

LOGGING["root"]["level"] = "CRITICAL"  # noqa: F405
