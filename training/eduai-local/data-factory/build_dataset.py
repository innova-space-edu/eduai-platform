#!/usr/bin/env python3
"""Build deterministic experimental EDUAI dataset splits. No network/GPU/secrets."""
from __future__ import annotations

import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SEED = Path(__file__).resolve().parent / "seed-v1.jsonl"
DEFAULT_HOLDOUT = ROOT / "training/eduai-local/eval-cases.jsonl"
DEFAULT_OUTPUT = ROOT / "artifacts/ai/dataset-factory-v1"
SCHEMA_VERSION = "eduai-dataset-factory-v1"
ALLOWED_SOURCE = "project-authored-synthetic"
ALLOWED_REVIEW = {"pending-human-review", "approved"}
ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{2,90}$")
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
RUT_PATTERN = re.compile(r"\b\d{1,2}\.?\d{3}\.?\d{3}-[0-9kK]\b")
SECRET_PATTERNS = (
    re.compile(r"\bKGAT_[A-Za-z0-9_\-]{12,}\b"),
    re.compile(r"\b(?:sk-[A-Za-z0-9_\-]{15,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_\-]{28,})\b"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\b(?:api[_-]?key|client[_-]?secret|password|token)\s*[:=]\s*['\"]?[A-Za-z0-9_\-/+=]{20,}", re.I),
)


class DatasetError(ValueError):
    pass


def normalize_prompt(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(c for c in value if not unicodedata.combining(c))
    return " ".join(value.casefold().split())


def read_jsonl(path: Path) -> list[dict]:
    if not path.is_file():
        raise DatasetError(f"Archivo JSONL no encontrado: {path}")
    if path.stat().st_size > 20 * 1024 * 1024:
        raise DatasetError("El dataset supera el límite de 20 MiB")
    rows = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise DatasetError(f"JSON incorrecto en línea {line_no}") from exc
        if not isinstance(row, dict):
            raise DatasetError(f"Línea {line_no}: se requiere un objeto JSON")
        rows.append(row)
    if not rows:
        raise DatasetError("El dataset está vacío")
    return rows


def validate(rows: list[dict], holdout_rows: list[dict]) -> tuple[dict[str, list[dict]], dict]:
    seen_ids, seen_prompts = set(), set()
    reserved = set()
    for i, row in enumerate(holdout_rows, 1):
        prompt = row.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            raise DatasetError(f"Holdout existente, línea {i}: falta prompt")
        reserved.add(normalize_prompt(prompt))
    groups: dict[str, list[dict]] = defaultdict(list)
    pending = 0
    for i, row in enumerate(rows, 1):
        rid, family = row.get("id"), row.get("family_id")
        if not isinstance(rid, str) or not ID_PATTERN.fullmatch(rid):
            raise DatasetError(f"Línea {i}: id inválido")
        if rid in seen_ids:
            raise DatasetError(f"Línea {i}: id duplicado: {rid}")
        if not isinstance(family, str) or not ID_PATTERN.fullmatch(family):
            raise DatasetError(f"Línea {i}: family_id inválido")
        if row.get("source") != ALLOWED_SOURCE:
            raise DatasetError(f"Línea {i}: solo se admiten ejemplos sintéticos propios")
        if row.get("review_status") not in ALLOWED_REVIEW:
            raise DatasetError(f"Línea {i}: review_status inválido")
        if row["review_status"] != "approved":
            pending += 1
        messages = row.get("messages")
        if not isinstance(messages, list) or len(messages) < 2:
            raise DatasetError(f"Línea {i}: faltan mensajes")
        if not all(isinstance(m, dict) and m.get("role") in ("system", "user", "assistant")
                   and isinstance(m.get("content"), str) and m["content"].strip()
                   and len(m["content"]) <= 6000 for m in messages):
            raise DatasetError(f"Línea {i}: mensajes/roles/contenido inválidos")
        if messages[-1]["role"] != "assistant" or not any(m["role"] == "user" for m in messages):
            raise DatasetError(f"Línea {i}: falta user o respuesta final assistant")
        combined = "\n".join(m["content"] for m in messages)
        if EMAIL_PATTERN.search(combined) or RUT_PATTERN.search(combined) or any(p.search(combined) for p in SECRET_PATTERNS):
            raise DatasetError(f"Línea {i}: posible dato personal o secreto")
        prompt = normalize_prompt("\n".join(m["content"] for m in messages if m["role"] == "user"))
        if prompt in seen_prompts or prompt in reserved:
            raise DatasetError(f"Línea {i}: duplicado o contaminación del holdout")
        seen_ids.add(rid)
        seen_prompts.add(prompt)
        groups[family].append(row)
    if len(groups) < 6:
        raise DatasetError("Se requieren al menos seis familias para train/validation/test")
    return dict(groups), {"examples": len(rows), "families": len(groups), "pending_human_review": pending}


def assign_groups(groups: dict, seed: str) -> dict[str, list[str]]:
    if not 1 <= len(seed) <= 64:
        raise DatasetError("La semilla debe tener entre 1 y 64 caracteres")
    ordered = sorted(groups, key=lambda family: (hashlib.sha256(f"{seed}:{family}".encode()).hexdigest(), family))
    n = len(ordered)
    val_count = max(1, round(n * 0.15))
    test_count = max(1, round(n * 0.15))
    train_count = n - val_count - test_count
    if train_count < 4:
        raise DatasetError("No quedan suficientes familias en entrenamiento")
    return {
        "train": ordered[:train_count],
        "validation": ordered[train_count:train_count + val_count],
        "test": ordered[train_count + val_count:],
    }


def build(seed_path: Path, holdout_path: Path, split_seed: str) -> tuple[dict[str, list[dict]], dict]:
    rows = read_jsonl(seed_path)
    groups, stats = validate(rows, read_jsonl(holdout_path))
    assignment = assign_groups(groups, split_seed)
    splits = {}
    for split, families in assignment.items():
        entries = [r for family in families for r in groups[family]]
        entries.sort(key=lambda row: row["id"])
        splits[split] = entries
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "split_seed": split_seed,
        "source_sha256": hashlib.sha256(seed_path.read_bytes()).hexdigest(),
        "holdout_sha256": hashlib.sha256(holdout_path.read_bytes()).hexdigest(),
        "source": ALLOWED_SOURCE,
        "human_review_pending": stats["pending_human_review"],
        "all_examples_reviewed": stats["pending_human_review"] == 0,
        "training_ready": False,
        "production_ready": False,
        "intent": "experimental-training-data-only",
        "stats": stats,
        "splits": {
            name: {"examples": len(rows), "families": assignment[name], "ids": [r["id"] for r in rows]}
            for name, rows in splits.items()
        },
        "notice": "El conjunto es pequeño y aún requiere revisión humana. No usar holdout para entrenar.",
    }
    return splits, manifest


def write_splits(splits: dict, manifest: dict, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in splits.items():
        path = output_dir / f"{name}.jsonl"
        with path.open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps({"messages": row["messages"]}, ensure_ascii=False) + "\n")
        manifest["splits"][name]["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    (output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="EDUAI Dataset Factory (no GPU)")
    parser.add_argument("--seed-file", type=Path, default=DEFAULT_SEED)
    parser.add_argument("--holdout-file", type=Path, default=DEFAULT_HOLDOUT)
    parser.add_argument("--split-seed", default="eduai-dataset-v1")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="Validar sin escribir archivos")
    args = parser.parse_args()
    try:
        splits, manifest = build(args.seed_file, args.holdout_file, args.split_seed)
        if not args.check:
            write_splits(splits, manifest, args.output_dir)
        print(json.dumps({
            "validated": True, "wrote_files": not args.check,
            "split_counts": {name: len(rows) for name, rows in splits.items()},
            "stats": manifest["stats"], "human_review_required": not manifest["all_examples_reviewed"],
            "training_ready": False, "production_ready": False
        }, ensure_ascii=False, indent=2))
    except DatasetError as exc:
        print(f"Dataset Factory ERROR: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
