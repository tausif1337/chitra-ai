"""Settings package.

Import a concrete module -- `config.settings.dev`, `.prod`, or `.test` -- via
DJANGO_SETTINGS_MODULE. This package intentionally exposes nothing itself so
that a missing DJANGO_SETTINGS_MODULE fails loudly instead of silently
loading an empty configuration.
"""
