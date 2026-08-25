"""Provider registry. `IMAGE_PROVIDER` in the environment picks one."""

from django.conf import settings

from .base import GeneratedAsset, GenerationRequest, ImageProvider
from .huggingface import HuggingFaceProvider
from .stub import StubProvider

PROVIDERS = {
    HuggingFaceProvider.name: HuggingFaceProvider,
    StubProvider.name: StubProvider,
}

__all__ = [
    "GeneratedAsset",
    "GenerationRequest",
    "ImageProvider",
    "HuggingFaceProvider",
    "StubProvider",
    "PROVIDERS",
    "get_provider",
]


def get_provider(name=None):
    """Build the configured provider. Raises KeyError for an unknown name."""
    key = name or settings.IMAGE_PROVIDER
    try:
        provider_class = PROVIDERS[key]
    except KeyError as exc:
        raise KeyError(
            f"Unknown IMAGE_PROVIDER {key!r}. Available: {sorted(PROVIDERS)}"
        ) from exc
    return provider_class()
