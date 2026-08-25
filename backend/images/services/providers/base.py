"""Provider-neutral contract for text-to-image generation (PRD FR-12).

Nothing above this layer knows that Hugging Face exists. Adding another
provider means writing one subclass and registering it -- no view, serializer,
or model changes.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class GenerationRequest:
    prompt: str
    width: int
    height: int
    quality: str


@dataclass(frozen=True)
class GeneratedAsset:
    """Raw result of a successful generation, before it is persisted."""

    image_bytes: bytes
    content_type: str
    provider: str
    model: str
    width: int
    height: int

    @property
    def extension(self):
        return {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}.get(
            self.content_type, "png"
        )


class ImageProvider(ABC):
    """A source of generated images."""

    name = "base"

    @abstractmethod
    def generate(self, request: GenerationRequest) -> GeneratedAsset:
        """Produce an image, or raise a `images.exceptions.GenerationError`."""

    @abstractmethod
    def describe(self) -> dict:
        """Non-sensitive provider metadata for the client. Never include tokens."""
