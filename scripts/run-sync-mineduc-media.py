#!/usr/bin/env python3
"""Ejecuta el sincronizador de Media aplicando alias oficiales de contingencia."""

from __future__ import annotations

import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).with_name("sync-mineduc-media.py")
spec = importlib.util.spec_from_file_location("sync_mineduc_media", SCRIPT)
if spec is None or spec.loader is None:
    raise RuntimeError(f"No se pudo cargar {SCRIPT}")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

original_fetch = module.fetch_html


def fetch_with_aliases(url: str) -> str:
    aliases = {
        "/educacion-ciudadana-3-medio/3-medio-fg": "/educacion-ciudadana-3m/3-medio-fg",
    }
    transport_url = url
    for old, new in aliases.items():
        transport_url = transport_url.replace(old, new)
    if transport_url != url:
        print(f"[red] usando alias oficial de transporte: {transport_url}", flush=True)
    return original_fetch(transport_url)


module.fetch_html = fetch_with_aliases
module.main()
