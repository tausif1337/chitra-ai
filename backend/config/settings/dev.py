"""Local development settings: http on localhost, so no Secure cookies."""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]", "testserver"]

CORS_ALLOWED_ORIGINS = env(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:5173", "http://127.0.0.1:5173"],
)

# Chrome refuses SameSite=None without Secure, and Secure cookies are dropped
# on plain http. On localhost the frontend and backend are same-site enough
# for Lax to work.
AUTH_COOKIE_SECURE = False
AUTH_COOKIE_SAMESITE = "Lax"

# Media is served by Django itself in development (see config/urls.py), but the
# React dev server runs on a different port. A relative /media/ URL would
# resolve against localhost:5173 and 404, so image URLs are made absolute
# against the API origin here just as MEDIA_BASE_URL does in production.
# `or` rather than a default: .env ships the key with an empty value, and an
# empty string is "set" as far as django-environ is concerned.
MEDIA_BASE_URL = env("MEDIA_BASE_URL", default="") or "http://localhost:8000"
