#!/usr/bin/env python3
"""Primer smoke test EDUAI Nano en Kaggle; nunca activa el router productivo."""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TRAIN = ROOT / "training/eduai-local/train_lora.py"
PROFILES = ROOT / "training/eduai-local/profiles.json"
DEFAULT_DATA = ROOT / "training/eduai-local/example-instructions.jsonl"
DEFAULT_OUTPUT = Path("/kaggle/working/eduai-nano-smoke-lora")


def validate_dataset(path: Path) -> tuple[int, str]:
    if not path.is_file():
        raise ValueError(f"Dataset no encontrado: {path}")
    n = 0
    with path.open(encoding="utf-8") as fh:
        for line_number, line in enumerate(fh, 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"JSONL inválido, línea {line_number}") from exc
            messages = row.get("messages") if isinstance(row, dict) else None
            if not isinstance(messages, list) or not messages:
                raise ValueError(f"Línea {line_number}: se requieren mensajes de chat")
            if not all(
                isinstance(m, dict)
                and m.get("role") in ("system", "user", "assistant")
                and isinstance(m.get("content"), str)
                and m["content"].strip()
                for m in messages
            ):
                raise ValueError(f"Línea {line_number}: roles o contenido inválidos")
            if messages[-1]["role"] != "assistant":
                raise ValueError(f"Línea {line_number}: la respuesta final debe ser assistant")
            n += 1
    if not n:
        raise ValueError("Dataset vacío")
    return n, hashlib.sha256(path.read_bytes()).hexdigest()


def package_versions() -> dict[str, str]:
    found = {}
    for name in ("torch", "transformers", "peft", "datasets", "accelerate", "bitsandbytes"):
        try:
            found[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            found[name] = "not-installed"
    return found


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Validar configuración sin GPU ni descargas")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--epochs", type=float, default=1.0)
    args = parser.parse_args()
    if not (0 < args.epochs <= 2):
        parser.error("Este smoke test solo permite 0 < epochs <= 2")
    if not TRAIN.is_file() or not PROFILES.is_file():
        raise SystemExit("Faltan archivos de EDUAI Model Factory")
    profiles = json.loads(PROFILES.read_text(encoding="utf-8"))
    model = profiles["eduai-nano"]["baseModel"]
    count, digest = validate_dataset(args.dataset.resolve())
    report = {
        "stage": "kaggle-phase1-smoke",
        "mode": "dry-run" if args.dry_run else "training",
        "model": model,
        "profile": "eduai-nano",
        "examples": count,
        "dataset_sha256": digest,
        "epochs": args.epochs,
        "dependency_versions": package_versions(),
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "status": "validated" if args.dry_run else "started",
        "production_enabled": False,
        "warning": "El dataset de ejemplo es solo para verificar la tubería; no valida calidad pedagógica.",
    }
    if args.dry_run:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0

    import torch

    if not torch.cuda.is_available():
        raise SystemExit("GPU CUDA no disponible. En Kaggle: Settings > Accelerator > GPU.")
    report["gpu"] = torch.cuda.get_device_name(0)
    args.output.mkdir(parents=True, exist_ok=True)
    metadata_file = args.output / "kaggle-smoke-report.json"
    cmd = [
        sys.executable, str(TRAIN),
        "--profile", "eduai-nano",
        "--dataset", str(args.dataset.resolve()),
        "--output", str(args.output),
        "--epochs", str(args.epochs),
        "--max-length", "512",
        "--batch-size", "1",
        "--grad-accum", "4",
        "--load-in-4bit",
    ]
    try:
        subprocess.run(cmd, cwd=ROOT, check=True)
        if not (args.output / "adapter_config.json").exists():
            raise RuntimeError("Finalizó el entrenador pero falta adapter_config.json")
        if not any(args.output.glob("adapter_model.*")):
            raise RuntimeError("Finalizó el entrenador pero falta el archivo de pesos del adaptador")
        report["status"] = "adapter-created"
        return 0
    except (subprocess.CalledProcessError, RuntimeError) as exc:
        report["status"] = "failed"
        report["error_type"] = type(exc).__name__
        raise
    finally:
        metadata_file.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )


if __name__ == "__main__":
    sys.exit(main())
