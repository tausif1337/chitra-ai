"""Authentication endpoints.

Token strategy (PRD section 12 -- credentials never reach the browser more
than they must):

* The **access token** is returned in the JSON body. React holds it in memory
  only, so a page reload discards it and nothing is left on disk for an XSS
  payload to steal.
* The **refresh token** is never in the body. It goes out as an httpOnly
  cookie scoped to `/api/auth/`, so script cannot read it and it is not
  attached to ordinary image requests.
* On reload React calls `/api/auth/refresh/`, the browser supplies the cookie,
  and a fresh access token comes back. `TrustedOrigin` guards that endpoint.
"""

import logging

from django.contrib.auth import get_user_model
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .security import (
    TrustedOrigin,
    clear_refresh_cookie,
    read_refresh_cookie,
    set_refresh_cookie,
)
from .serializers import ChangePasswordSerializer, RegisterSerializer, UserSerializer

logger = logging.getLogger("chitra.auth")
User = get_user_model()


def _auth_payload(user, refresh):
    """Body returned by login, register, and refresh."""
    return {
        "access": str(refresh.access_token),
        "user": UserSerializer(user).data,
    }


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "anon"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        response = Response(_auth_payload(user, refresh), status=status.HTTP_201_CREATED)
        return set_refresh_cookie(response, refresh)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "anon"

    def post(self, request):
        serializer = TokenObtainPairSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        refresh = RefreshToken(serializer.validated_data["refresh"])
        response = Response(_auth_payload(user, refresh), status=status.HTTP_200_OK)
        return set_refresh_cookie(response, refresh)


class RefreshView(APIView):
    """Exchange the refresh cookie for a new access token, rotating the cookie."""

    permission_classes = [AllowAny, TrustedOrigin]

    def post(self, request):
        raw = read_refresh_cookie(request)
        if not raw:
            return Response(
                {"detail": "Your session has ended. Please sign in again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            refresh = RefreshToken(raw)
            user = User.objects.get(pk=refresh["user_id"], is_active=True)
            refresh.blacklist()
            new_refresh = RefreshToken.for_user(user)
        except (TokenError, User.DoesNotExist, KeyError) as exc:
            logger.info("Refresh rejected: %s", exc.__class__.__name__)
            response = Response(
                {"detail": "Your session has ended. Please sign in again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            return clear_refresh_cookie(response)

        response = Response(_auth_payload(user, new_refresh), status=status.HTTP_200_OK)
        return set_refresh_cookie(response, new_refresh)


class LogoutView(APIView):
    permission_classes = [AllowAny, TrustedOrigin]

    def post(self, request):
        raw = read_refresh_cookie(request)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass  # Already expired or blacklisted; clearing the cookie is enough.
        response = Response(status=status.HTTP_204_NO_CONTENT)
        return clear_refresh_cookie(response)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Changing a password invalidates the old session: hand back a brand
        # new pair so the current tab stays signed in and other tabs do not.
        refresh = RefreshToken.for_user(user)
        response = Response(_auth_payload(user, refresh), status=status.HTTP_200_OK)
        return set_refresh_cookie(response, refresh)
