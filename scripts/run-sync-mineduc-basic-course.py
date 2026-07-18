#!/usr/bin/env python3
"""Ejecuta el sincronizador curricular usando curl con IPv4 y reintentos.

Este lanzador evita bloqueos transitorios de red observados con urllib en
GitHub Actions. El parser, las comprobaciones de secuencia y la escritura de
archivos permanecen en sync-mineduc-basic-course.py.
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).with_name("sync-mineduc-basic-course.py")
spec = importlib.util.spec_from_file_location("sync_mineduc_basic_course", SCRIPT)
if spec is None or spec.loader is None:
    raise RuntimeError(f"No se pudo cargar {SCRIPT}")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fetch_with_curl(url: str) -> str:
    command = [
        "curl",
        "--ipv4",
        "--location",
        "--fail",
        "--silent",
        "--show-error",
        "--connect-timeout",
        "20",
        "--max-time",
        "180",
        "--retry",
        "5",
        "--retry-all-errors",
        "--retry-delay",
        "5",
        "--header",
        "Accept-Language: es-CL,es;q=0.9",
        "--user-agent",
        "Mozilla/5.0 (compatible; EduAI-Curriculum-Audit/1.0; +https://github.com/innova-space-edu/eduai-platform)",
        url,
    ]
    completed = subprocess.run(command, check=True, capture_output=True)
    return completed.stdout.decode("utf-8", errors="strict")


module.fetch_html = fetch_with_curl
module.main()
