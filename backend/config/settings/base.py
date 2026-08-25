"""Base settings shared by every Chitra AI environment.

Environment-specific overrides live in `dev.py` and `prod.py`. Never put a
secret literal in this file -- everything sensitive is read from the
environment (PRD section 12: "Store secrets using environment variables").
"""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, []),
    HF_MODEL=(str, "black-forest-labs/FLUX.1-schnell"),
    HF_PROVIDER=(str, "auto"),
    HF_TIMEOUT=(int, 120),
    IMAGE_PROVIDER=(str, "huggingface"),
    IMAGE_STORAGE=(str, "local"),
    MEDIA_BASE_URL=(str, ""),
    GENERATION_RATE=(str, "20/hour"),
    ANON_RATE=(str, "30/hour"),
    USER_RATE=(str, "300/hour"),
)

environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "accounts",
    "images",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["CONN_MAX_AGE"] = 60

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
# Absolute origin prepended to media URLs so the Vercel frontend can load
# images from the VPS. Empty in development, where paths are same-origin.
MEDIA_BASE_URL = env("MEDIA_BASE_URL", default="")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Django REST Framework -------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
    "DEFAULT_PAGINATION_CLASS": "images.pagination.HistoryPagination",
    "PAGE_SIZE": 12,
    "EXCEPTION_HANDLER": "config.exception_handler.chitra_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("ANON_RATE"),
        "user": env("USER_RATE"),
        "generation": env("GENERATION_RATE"),
    },
}

# --- JWT -------------------------------------------------------------------
# The access token is short lived and lives only in React memory. The refresh
# token never reaches JavaScript: it is written as an httpOnly cookie by the
# auth views in `accounts/views.py`.

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# The refresh cookie is httpOnly, so no script on any origin can read it.
# Because the SPA is served from a different origin than the API, the cookie
# must be SameSite=None to be sent at all -- which means SameSite provides no
# CSRF protection. The cookie-authenticated endpoints (refresh, logout)
# therefore validate the Origin header against CORS_ALLOWED_ORIGINS instead;
# a browser will not let an attacker page forge that header. See
# `accounts/security.py`.
AUTH_COOKIE_REFRESH = "chitra_refresh"
AUTH_COOKIE_PATH = "/api/auth/"
AUTH_COOKIE_SECURE = True
AUTH_COOKIE_SAMESITE = "None"
AUTH_COOKIE_DOMAIN = None

# --- CORS ------------------------------------------------------------------

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = (
    "accept",
    "authorization",
    "content-type",
    "origin",
    "user-agent",
)

# --- Image generation ------------------------------------------------------

IMAGE_PROVIDER = env("IMAGE_PROVIDER")
IMAGE_STORAGE = env("IMAGE_STORAGE")
HF_TOKEN = env("HF_TOKEN", default="")
HF_MODEL = env("HF_MODEL")
HF_PROVIDER = env("HF_PROVIDER")
HF_TIMEOUT = env("HF_TIMEOUT")

# --- Logging ---------------------------------------------------------------
# PRD section 17: diagnostics are logged server side, never returned to the
# user, and must never contain credentials.

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
        "chitra": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
