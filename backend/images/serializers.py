"""Request and response shapes for the image endpoints (PRD FR-02, section 10)."""

from rest_framework import serializers

from .constants import (
    MAX_PROMPT_LENGTH,
    MIN_PROMPT_LENGTH,
    QUALITY_CHOICES,
    QUALITY_STANDARD,
    SIZE_CHOICES,
    SIZE_SQUARE,
)
from .models import GeneratedImage


class GeneratedImageSerializer(serializers.ModelSerializer):
    download_filename = serializers.CharField(read_only=True)

    class Meta:
        model = GeneratedImage
        fields = (
            "id",
            "prompt",
            "image_url",
            "size",
            "quality",
            "provider",
            "model",
            "width",
            "height",
            "byte_size",
            "download_filename",
            "created_at",
        )
        read_only_fields = fields


class GenerationRequestSerializer(serializers.Serializer):
    """Validates a generation request before any provider call is made."""

    prompt = serializers.CharField(
        max_length=MAX_PROMPT_LENGTH,
        min_length=MIN_PROMPT_LENGTH,
        trim_whitespace=True,
        error_messages={
            "blank": "Describe the image you want to generate.",
            "min_length": f"Add a little more detail (at least {MIN_PROMPT_LENGTH} characters).",
            "max_length": f"Prompts are limited to {MAX_PROMPT_LENGTH} characters.",
            "required": "Describe the image you want to generate.",
        },
    )
    size = serializers.ChoiceField(
        choices=SIZE_CHOICES,
        default=SIZE_SQUARE,
        error_messages={"invalid_choice": "Pick one of the supported image sizes."},
    )
    quality = serializers.ChoiceField(
        choices=QUALITY_CHOICES,
        default=QUALITY_STANDARD,
        error_messages={"invalid_choice": "Pick one of the supported quality settings."},
    )

    def validate_prompt(self, value):
        if not value.strip():
            raise serializers.ValidationError("Describe the image you want to generate.")
        return value.strip()
