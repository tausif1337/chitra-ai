"""Image generation and history endpoints (PRD section 10).

Every endpoint is scoped to `request.user`: the queryset filter is what makes
one account's history invisible to another, so it lives on the base class and
is never overridden.
"""

import logging

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .constants import QUALITY_CHOICES, SIZE_CHOICES
from .models import GeneratedImage
from .serializers import GeneratedImageSerializer, GenerationRequestSerializer
from .services.generation import delete_image, generate_image, provider_metadata

logger = logging.getLogger("chitra.api")


class OwnedImagesMixin:
    permission_classes = [IsAuthenticated]
    serializer_class = GeneratedImageSerializer

    def get_queryset(self):
        return GeneratedImage.objects.filter(user=self.request.user)


class GenerateImageView(APIView):
    """POST /api/images/generate/"""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "generation"

    def post(self, request):
        serializer = GenerationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        image = generate_image(user=request.user, **serializer.validated_data)
        return Response(
            GeneratedImageSerializer(image).data, status=status.HTTP_201_CREATED
        )


class ImageListView(OwnedImagesMixin, generics.ListAPIView):
    """GET /api/images/ -- the signed-in user's history, newest first."""


class ImageDetailView(OwnedImagesMixin, generics.RetrieveDestroyAPIView):
    """GET and DELETE /api/images/{id}/"""

    def perform_destroy(self, instance):
        logger.info("Deleting image id=%s user=%s", instance.pk, self.request.user.pk)
        delete_image(instance)


class GenerationOptionsView(APIView):
    """GET /api/images/options/ -- what the generator controls should offer.

    Served from the backend so the UI can never drift out of sync with what the
    configured model actually supports (PRD FR-03, FR-04).
    """

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "sizes": [
                    {"value": value, "label": label, "aspect": _aspect(value)}
                    for value, label in SIZE_CHOICES
                ],
                "qualities": [
                    {"value": value, "label": label}
                    for value, label in QUALITY_CHOICES
                ],
                **provider_metadata(),
            }
        )


class HealthView(APIView):
    """GET /api/health/ -- liveness probe for the VPS."""

    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        return Response({"status": "ok"})


def _aspect(size):
    width, _, height = size.partition("x")
    return f"{width} / {height}"
