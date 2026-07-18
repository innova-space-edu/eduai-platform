#!/usr/bin/env python3
"""Ejecuta el sincronizador de Parvularia con validación de secuencia oficial.

Currículum Nacional publica en Sala Cuna los OA 03 y 04 del núcleo CES con la
misma descripción. Esto no es un código duplicado ni una inferencia local, por
lo que el control correcto es validar la secuencia y conservar literalmente
ambos registros oficiales.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).with_name("sync-mineduc-parvularia.py")
spec = importlib.util.spec_from_file_location("sync_mineduc_parvularia", SCRIPT)
if spec is None or spec.loader is None:
    raise RuntimeError(f"No se pudo cargar {SCRIPT}")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def validate_official_sequence(items: list[dict], kind: str, nucleus: str, tramo: str) -> None:
    numbers = sorted(item["numero"] for item in items)
    expected = list(range(1, max(numbers) + 1))
    if numbers != expected:
        raise RuntimeError(
            f"Secuencia incompleta para {kind} {nucleus} {tramo}: obtenida {numbers}, esperada {expected}"
        )


module.validate_nucleus_sequence = validate_official_sequence
module.main()
