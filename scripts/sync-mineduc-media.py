#!/usr/bin/env python3
"""Compatibility entry point: rebuild the complete reviewed Media catalogue.

This replays archived official sources; it does not claim to fetch a new version.
See docs/AUDITORIA_OA_MEDIA_20261106.md before updating the source snapshots.
"""
from pathlib import Path
import runpy


def main():
    runpy.run_path(str(Path(__file__).with_name("audit-media-2026.py")), run_name="__main__")


if __name__ == "__main__":
    main()
