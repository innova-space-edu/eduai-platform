#!/usr/bin/env python3
"""Deliberately explicit native Bonsai 2 preflight and optional CPU smoke run.

NO installation, NO download, NO shell, NO background server, NO cloud.
The executable must be reviewed and independently SHA-256 pinned by the operator.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import time
from artifact_store import ArtifactStore, CacheError, clean_digest, hash_file, DEFAULT_CACHE

KNOWN_BONSAI_IDS = frozenset(("bonsai2-2b", "bonsai2-4b", "bonsai2-9b", "bonsai2-27b"))
RELEASE_ID_RE = re.compile(r"^prism-b[0-9]+-[0-9a-f]{7,12}$")
PROBE_PROMPT = "Responde con una palabra en español: ¿de qué color es el cielo despejado?"


def check_binary(binary: Path, expected_sha256: str, release_id: str) -> dict:
    expected = clean_digest(expected_sha256)
    if not RELEASE_ID_RE.fullmatch(release_id):
        raise CacheError("Se requiere un identificador de release PrismML explícito")
    if binary.is_symlink() or not binary.is_file():
        raise CacheError("El ejecutable no puede ser un enlace simbólico")
    mode = binary.stat().st_mode
    if not stat.S_ISREG(mode) or not (mode & 0o111):
        raise CacheError("Debe señalar un ejecutable regular de llama-cli")
    actual, n = hash_file(binary)
    if actual != expected:
        raise CacheError("SHA-256 del ejecutable no coincide")
    return {
        "binary": str(binary.resolve()), "binary_sha256": actual, "binary_bytes": n,
        "release_claim": release_id,
        "warning": "Un hash coincidente NO certifica que el ejecutable sea legítimo ni soporte PTQ1_0: comprobar procedencia y benchmark.",
    }


def preflight(
    store: ArtifactStore, model_id: str, model_sha256: str,
    binary: Path, binary_sha256: str, release_id: str,
) -> dict:
    if model_id not in KNOWN_BONSAI_IDS:
        raise CacheError("Solo se permiten referencias Bonsai 2 previamente definidas")
    expected = clean_digest(model_sha256)
    entries = store.list()
    record = next((item for item in entries if item["sha256"] == expected), None)
    if record is None or model_id not in record["model_ids"]:
        raise CacheError("El modelo no figura en el caché autorizado con ese ID")
    verified = store.verify(expected)
    if "PTQ1_0" not in Path(verified["path"]).name.upper():
        # Internal storage is SHA-named; format must be attested by registry metadata, not file name.
        pass
    backend = check_binary(binary, binary_sha256, release_id)
    return {
        "model_id": model_id, "model_sha256": expected,
        "model_bytes": verified["bytes"], "model_path": verified["path"],
        "backend": backend, "execution_authorized": False,
        "format_claim": "PTQ1_0",
        "warning": "Integridad comprobada. Formato, origen de binario y corrección aún requieren validación real.",
    }


def run_cpu_smoke(preflight_report: dict, context: int, tokens: int, timeout: int) -> dict:
    if context < 512 or context > 2048 or tokens < 8 or tokens > 64 or timeout < 30 or timeout > 240:
        raise CacheError("Los límites de contexto/tokens/timeout deben respetarse")
    command = [
        preflight_report["backend"]["binary"], "-m", preflight_report["model_path"],
        "-c", str(context), "-n", str(tokens), "-ngl", "0", "-p", PROBE_PROMPT,
    ]
    started = time.monotonic()
    try:
        completed = subprocess.run(
            command, capture_output=True, text=True, timeout=timeout,
            check=False, shell=False,
        )
    except (subprocess.TimeoutExpired, OSError) as exc:
        raise CacheError("Falló o agotó el tiempo la ejecución nativa de prueba") from exc
    elapsed = round(time.monotonic() - started, 3)
    return {
        "status": "completed" if completed.returncode == 0 else "failed",
        "return_code": completed.returncode, "wall_seconds": elapsed,
        "backend": "cpu", "n_gpu_layers_requested": 0,
        "context": context, "max_new_tokens": tokens,
        "stdout_tail": completed.stdout[-1500:],
        "stderr_tail": completed.stderr[-1500:],
        "quality_approved": False, "production_ready": False,
        "notice": "La muestra requiere revisión humana y benchmark posterior; no se ha medido el pico de RAM/VRAM.",
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="EDUAI Bonsai 2 native preflight, without download or installation")
    p.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    p.add_argument("--model-id", required=True, choices=sorted(KNOWN_BONSAI_IDS))
    p.add_argument("--model-sha256", required=True)
    p.add_argument("--binary", type=Path, required=True)
    p.add_argument("--binary-sha256", required=True)
    p.add_argument("--release-id", required=True)
    p.add_argument("--run-cpu-smoke", action="store_true", help="Ejecución explícita después del preflight")
    p.add_argument("--context", type=int, default=512)
    p.add_argument("--tokens", type=int, default=32)
    p.add_argument("--timeout", type=int, default=120)
    args = p.parse_args(argv)
    try:
        plan = preflight(
            ArtifactStore(args.cache_dir), args.model_id, args.model_sha256,
            args.binary, args.binary_sha256, args.release_id,
        )
        if args.run_cpu_smoke:
            plan["smoke"] = run_cpu_smoke(plan, args.context, args.tokens, args.timeout)
        print(json.dumps({"ok": True, "result": plan}, ensure_ascii=False, indent=2))
        return 0
    except (CacheError, OSError, ValueError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
