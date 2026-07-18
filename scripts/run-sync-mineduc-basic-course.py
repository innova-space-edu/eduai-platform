#!/usr/bin/env python3
"""Ejecuta el sincronizador curricular con transporte de red resiliente.

Primero consulta la URL canónica de Currículum Nacional. Si la infraestructura
de MINEDUC no responde desde GitHub Actions, usa el espejo de preproducción del
mismo portal únicamente como transporte; los archivos conservan como fuente la
URL canónica y el parser valida códigos, secuencia y cantidad antes de escribir.
"""

from __future__ import annotations

import importlib.util
import subprocess
from pathlib import Path

SCRIPT = Path(__file__).with_name("sync-mineduc-basic-course.py")
spec = importlib.util.spec_from_file_location("sync_mineduc_basic_course", SCRIPT)
if spec is None or spec.loader is None:
    raise RuntimeError(f"No se pudo cargar {SCRIPT}")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def curl(url: str, attempts: int) -> str:
    command = [
        "curl",
        "--ipv4",
        "--location",
        "--fail",
        "--silent",
        "--show-error",
        "--connect-timeout",
        "15",
        "--max-time",
        "90",
        "--retry",
        str(attempts),
        "--retry-all-errors",
        "--retry-delay",
        "3",
        "--header",
        "Accept-Language: es-CL,es;q=0.9",
        "--user-agent",
        "Mozilla/5.0 (compatible; EduAI-Curriculum-Audit/1.0; +https://github.com/innova-space-edu/eduai-platform)",
        url,
    ]
    completed = subprocess.run(command, check=True, capture_output=True)
    return completed.stdout.decode("utf-8", errors="strict")


def fetch_with_fallback(url: str) -> str:
    try:
        return curl(url, attempts=1)
    except subprocess.CalledProcessError as canonical_error:
        mirror = url.replace(
            "https://www.curriculumnacional.cl/",
            "https://pre-curriculumnacional.tifon.cl/",
            1,
        )
        print(
            f"[red] URL canónica no disponible ({canonical_error.returncode}); "
            f"consultando espejo oficial de contingencia: {mirror}",
            flush=True,
        )
        return curl(mirror, attempts=3)


module.fetch_html = fetch_with_fallback
module.main()
