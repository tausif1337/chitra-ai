"""Persistence for generated images (PRD section 11)."""

from django.conf import settings
from django.db import models

from .constants import QUALITY_CHOICES, SIZE_CHOICES


class GeneratedImage(models.Model):
    """One successful generation and everything needed to show it again."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="images",
    )
    prompt = models.TextField()
    image_url = models.URLField(max_length=500)
    # Storage-relative key. Kept alongside the URL so the object can still be
    # deleted after MEDIA_BASE_URL or the storage backend changes.
    storage_key = models.CharField(max_length=300)
    size = models.CharField(max_length=20, choices=SIZE_CHOICES)
    quality = models.CharField(max_length=20, choices=QUALITY_CHOICES)
    provider = models.CharField(max_length=50)
    model = models.CharField(max_length=120)
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    byte_size = models.PositiveIntegerField(default=0)
    duration_ms = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(fields=["user", "-created_at"], name="image_user_recent_idx"),
        ]

    def __str__(self):
        preview = self.prompt[:40]
        return f"{preview}... ({self.size})" if len(self.prompt) > 40 else f"{preview} ({self.size})"

    @property
    def download_filename(self):
        """Meaningful filename for the download action (PRD FR-08)."""
        words = [w for w in "".join(
            c if c.isalnum() or c.isspace() else " " for c in self.prompt
        ).split()][:6]
        slug = "-".join(w.lower() for w in words) or "image"
        stamp = self.created_at.strftime("%Y%m%d-%H%M%S") if self.created_at else "draft"
        return f"chitra-{slug}-{stamp}.png"
