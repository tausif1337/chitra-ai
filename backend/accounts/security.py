"""Cookie handling and CSRF defence for the cookie-authenticated endpoints."""

from urllib.parse import urlparse

from django.conf import settings
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def _allowed_origins():
    return {o.rstrip("/") for o in settings.CORS_ALLOWED_ORIGINS}


class TrustedOrigin(BasePermission):
    """Reject state-changing requests that did not come from a known origin.

    The refresh cookie is SameSite=None (it has to be -- the SPA lives on a
    different origin), so the browser will attach it to a cross-site POST from
    any page. What an attacker page cannot do is set the Origin header: the
    browser stamps it from the page's own origin. Comparing that against the
    CORS allowlist is what stops a forged refresh or logout.

    Requests with no Origin *and* no Referer are allowed through only when
    they are not browser-initiated cross-site requests -- i.e. same-origin
    server-side calls and the test client. Any request that presents an origin
    is held to the allowlist.
    """

    message = "Request origin is not allowed."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        origin = request.META.get("HTTP_ORIGIN")
        if origin is None:
            referer = request.META.get("HTTP_REFERER")
            if not referer:
                # No browser context at all (curl, server-to-server, tests).
                # There is no ambient cookie to abuse in that case.
                return True
            parsed = urlparse(referer)
            origin = f"{parsed.scheme}://{parsed.netloc}"

        if origin.rstrip("/") in _allowed_origins():
            return True
        raise PermissionDenied(self.message)


def set_refresh_cookie(response, refresh_token):
    """Attach the rotated refresh token as an httpOnly cookie."""
    response.set_cookie(
        settings.AUTH_COOKIE_REFRESH,
        str(refresh_token),
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        secure=settings.AUTH_COOKIE_SECURE,
        httponly=True,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(
        settings.AUTH_COOKIE_REFRESH,
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    return response


def read_refresh_cookie(request):
    return request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
