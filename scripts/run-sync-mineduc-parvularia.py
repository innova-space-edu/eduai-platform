#!/usr/bin/env python3
"""Ejecuta el sincronizador oficial de Educación Parvularia.

La auditoría del 20-09-2026 contrasta la base local con las BCEP 2018 de
MINEDUC. El parser conserva las secuencias oficiales por núcleo, rechaza
descripciones duplicadas y elimina texto de navegación/footer del sitio.
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
module.main()
