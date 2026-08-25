"""Production settings for the Hostinger VPS deployment.

The React client is served from Vercel, so the browser treats every API call
as cross-site. That forces SameSite=None on the refresh cookie, which in turn
forces Secure, which in turn forces HTTPS (PRD section 12).
"""

from .base import *  # noqa: F401,F403

DEBUG = False

SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"

AUTH_COOKIE_SECURE = True
AUTH_COOKIE_SAMESITE = "None"
