#!/usr/bin/env python
"""Command-line entry point for Chitra AI.

Defaults to development settings. Override per environment:
    DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py migrate
"""

import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Could not import Django. Is the virtualenv activated and are "
            "requirements installed?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
