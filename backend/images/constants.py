"""Supported generation options (PRD FR-03 and FR-04).

Sizes are the ones the PRD names. Quality is not a native FLUX parameter --
FR-04 says to "map them appropriately", so each quality tier maps onto real
sampler settings, chosen per model family because a guidance-distilled model
like FLUX.1-schnell wants a very different step count than FLUX.1-dev.
"""

SIZE_SQUARE = "1024x1024"
SIZE_PORTRAIT = "1024x1536"
SIZE_LANDSCAPE = "1536x1024"

SIZE_CHOICES = (
    (SIZE_SQUARE, "Square 1024 x 1024"),
    (SIZE_PORTRAIT, "Portrait 1024 x 1536"),
    (SIZE_LANDSCAPE, "Landscape 1536 x 1024"),
)
SUPPORTED_SIZES = tuple(value for value, _ in SIZE_CHOICES)

QUALITY_STANDARD = "standard"
QUALITY_HD = "hd"

QUALITY_CHOICES = (
    (QUALITY_STANDARD, "Standard"),
    (QUALITY_HD, "High detail"),
)
SUPPORTED_QUALITIES = tuple(value for value, _ in QUALITY_CHOICES)

MAX_PROMPT_LENGTH = 1000
MIN_PROMPT_LENGTH = 3

# Sampler settings per model family. `default` covers any model not listed.
QUALITY_PROFILES = {
    "schnell": {
        # Timestep-distilled: it is trained to converge in about four steps and
        # ignores classifier-free guidance entirely.
        QUALITY_STANDARD: {"num_inference_steps": 4, "guidance_scale": 0.0},
        QUALITY_HD: {"num_inference_steps": 8, "guidance_scale": 0.0},
    },
    "dev": {
        QUALITY_STANDARD: {"num_inference_steps": 20, "guidance_scale": 3.5},
        QUALITY_HD: {"num_inference_steps": 40, "guidance_scale": 4.5},
    },
    "default": {
        QUALITY_STANDARD: {"num_inference_steps": 25, "guidance_scale": 7.0},
        QUALITY_HD: {"num_inference_steps": 45, "guidance_scale": 7.5},
    },
}


def parse_size(size):
    """"1024x1536" -> (1024, 1536). Assumes the value already passed validation."""
    width, _, height = size.partition("x")
    return int(width), int(height)


def quality_profile(model, quality):
    """Sampler kwargs for a model/quality pair."""
    family = "default"
    lowered = (model or "").lower()
    if "schnell" in lowered:
        family = "schnell"
    elif "dev" in lowered:
        family = "dev"
    return dict(QUALITY_PROFILES[family][quality])
