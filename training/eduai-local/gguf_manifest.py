#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact", required=True)
    parser.add_argument("--quant", required=True)
    args = parser.parse_args()

    artifact = Path(args.artifact)
    if not artifact.exists():
        raise SystemExit(f"Artefacto no encontrado: {artifact}")

    sha = hashlib.sha256()
    with artifact.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            sha.update(block)

    manifest = {
        "artifact": str(artifact),
        "bytes": artifact.stat().st_size,
        "quant": args.quant,
        "sha256": sha.hexdigest(),
        "stage": "browser-candidate",
    }
    output = Path(str(artifact) + ".manifest.json")
    output.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
