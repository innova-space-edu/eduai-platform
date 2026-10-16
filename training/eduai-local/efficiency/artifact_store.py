#!/usr/bin/env python3
"""EDUAI Model Lab V2: offline, content-addressed GGUF cache on local SSD.

Only imports local, user-supplied files with an independently known SHA-256.
No network, subprocess, model execution, cloud sync or automatic deletion.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import tempfile
import time

SHA_RE = re.compile(r"^[0-9a-f]{64}$")
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$")
DEFAULT_CACHE = Path.home() / ".cache" / "eduai-model-lab" / "gguf-v2"
COPY_BLOCK = 1024 * 1024
MAX_IMPORT_BYTES = 32 * 1024**3
MIN_FREE_BYTES = 512 * 1024**2


class CacheError(ValueError):
    pass


def clean_digest(raw: str) -> str:
    if not isinstance(raw, str) or not SHA_RE.fullmatch(raw.lower()):
        raise CacheError("SHA-256 esperado: 64 caracteres hexadecimales")
    return raw.lower()


def safe_model_id(raw: str) -> str:
    if not isinstance(raw, str) or not ID_RE.fullmatch(raw):
        raise CacheError("Identificador de modelo inválido")
    return raw


def hash_file(path: Path) -> tuple[str, int]:
    if path.is_symlink():
        raise CacheError("Se rechazan enlaces simbólicos")
    try:
        fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0))
    except OSError as exc:
        raise CacheError("No se pudo abrir el archivo regular") from exc
    sha = hashlib.sha256()
    size = 0
    try:
        with os.fdopen(fd, "rb") as stream:
            if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                raise CacheError("Solo se aceptan archivos regulares")
            for block in iter(lambda: stream.read(COPY_BLOCK), b""):
                sha.update(block)
                size += len(block)
    finally:
        pass
    return sha.hexdigest(), size


class ArtifactStore:
    def __init__(self, root: Path):
        if root.is_symlink():
            raise CacheError("La raíz del caché no puede ser un enlace simbólico")
        self.root = root.expanduser().resolve()
        self.files_dir = self.root / "sha256"
        self.index_path = self.root / "index.json"

    @contextmanager
    def _lock(self):
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        if self.files_dir.is_symlink() or self.index_path.is_symlink():
            raise CacheError("No se permiten enlaces simbólicos dentro del caché")
        self.files_dir.mkdir(mode=0o700, exist_ok=True)
        lock = self.root / ".index.lock"
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0), 0o600)
        except FileExistsError as exc:
            raise CacheError("Caché bloqueado por otra operación; verificar si hay proceso activo") from exc
        try:
            os.close(fd)
            yield
        finally:
            lock.unlink(missing_ok=True)

    def _read(self) -> dict:
        if self.index_path.is_symlink():
            raise CacheError("Índice simbólico prohibido")
        if not self.index_path.exists():
            return {"schema": 1, "entries": {}}
        if self.index_path.is_symlink() or self.index_path.stat().st_size > 4_000_000:
            raise CacheError("Índice inseguro o demasiado grande")
        try:
            obj = json.loads(self.index_path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise CacheError("Índice corrupto: no se sobrescribirá") from exc
        if (not isinstance(obj, dict) or obj.get("schema") != 1
                or not isinstance(obj.get("entries"), dict)):
            raise CacheError("Índice incompatible")
        for digest, entry in obj["entries"].items():
            clean_digest(digest)
            if not isinstance(entry, dict) or entry.get("sha256") != digest:
                raise CacheError("Índice inconsistente")
        return obj

    def _save(self, obj: dict):
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        temp_name = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=self.root, prefix=".index-",
                suffix=".tmp", delete=False,
            ) as f:
                temp_name = f.name
                os.chmod(temp_name, 0o600)
                json.dump(obj, f, ensure_ascii=False, sort_keys=True, indent=2)
                f.write("\n")
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_name, self.index_path)
        finally:
            if temp_name:
                Path(temp_name).unlink(missing_ok=True)

    def _file(self, digest: str) -> Path:
        return self.files_dir / (clean_digest(digest) + ".gguf")

    def _verified(self, digest: str) -> tuple[Path, int]:
        path = self._file(digest)
        if not path.is_file() or path.is_symlink():
            raise CacheError("Artefacto ausente o no regular")
        actual, size = hash_file(path)
        if actual != digest:
            raise CacheError("SHA-256 del artefacto no coincide; no usarlo")
        return path, size

    def add(self, source: Path, model_id: str, expected_sha256: str, *, pin: bool = False, quantization: str = "unspecified") -> dict:
        digest = clean_digest(expected_sha256)
        safe_model_id(model_id)
        if not re.fullmatch(r"[A-Z][A-Z0-9_]{1,20}|unspecified", quantization):
            raise CacheError("Formato de cuantización inválido")
        if model_id.startswith("bonsai2-") and (
            quantization not in ("PTQ1_0", "PQ2_0", "Q2_0")
            or quantization not in source.name.upper()
        ):
            raise CacheError("Bonsai 2 requiere declarar el formato presente en el nombre original del archivo")
        if source.suffix.lower() != ".gguf" or source.is_symlink() or not source.is_file():
            raise CacheError("Importar únicamente GGUF regular y sin enlaces simbólicos")
        if self.root in source.resolve().parents:
            raise CacheError("No importar archivos internos del propio caché")
        if not 4 <= source.stat().st_size <= MAX_IMPORT_BYTES:
            raise CacheError("Tamaño fuera de los límites admitidos")
        with self._lock():
            idx = self._read()
            dest = self._file(digest)
            if dest.exists():
                _, n = self._verified(digest)
            else:
                size = source.stat().st_size
                if shutil.disk_usage(self.root).free < size + MIN_FREE_BYTES:
                    raise CacheError("SSD insuficiente: reservar al menos 512 MiB adicionales")
                fd, temp_name = tempfile.mkstemp(prefix=".part-", suffix=".gguf", dir=self.files_dir)
                sha = hashlib.sha256()
                n = 0
                try:
                    with os.fdopen(fd, "wb") as writer, source.open("rb") as reader:
                        if reader.read(4) != b"GGUF":
                            raise CacheError("Cabecera GGUF inválida")
                        reader.seek(0)
                        for block in iter(lambda: reader.read(COPY_BLOCK), b""):
                            sha.update(block)
                            n += len(block)
                            if n > MAX_IMPORT_BYTES:
                                raise CacheError("Archivo supera el límite")
                            writer.write(block)
                        writer.flush()
                        os.fsync(writer.fileno())
                    if sha.hexdigest() != digest:
                        raise CacheError("SHA-256 incorrecto; archivo rechazado")
                    os.chmod(temp_name, 0o600)
                    os.replace(temp_name, dest)
                finally:
                    Path(temp_name).unlink(missing_ok=True)
            current = idx["entries"].get(digest, {})
            if current and current.get("quantization") != quantization:
                raise CacheError("Formato inconsistente para el mismo SHA-256")
            aliases = sorted(set(current.get("model_ids", [])) | {model_id})
            idx["entries"][digest] = {
                "sha256": digest, "bytes": n, "model_ids": aliases,
                "pinned": bool(pin or current.get("pinned", False)),
                "last_used": time.time(), "format": "GGUF",
                "verified": True, "local_only": True,
                "quantization": quantization, "source_name": source.name,
            }
            self._save(idx)
            return dict(idx["entries"][digest], path=str(dest), reused=bool(current))

    def list(self) -> list[dict]:
        entries = self._read()["entries"]
        return [dict(v, present=self._file(k).is_file() and not self._file(k).is_symlink())
                for k, v in sorted(entries.items())]

    def verify(self, digest: str) -> dict:
        digest = clean_digest(digest)
        if digest not in self._read()["entries"]:
            raise CacheError("Artefacto no registrado")
        path, size = self._verified(digest)
        return {"sha256": digest, "verified": True, "bytes": size, "path": str(path)}

    def pin(self, digest: str, value: bool) -> dict:
        digest = clean_digest(digest)
        with self._lock():
            idx = self._read()
            if digest not in idx["entries"]:
                raise CacheError("Artefacto no registrado")
            self._verified(digest)
            idx["entries"][digest]["pinned"] = bool(value)
            self._save(idx)
            return {"sha256": digest, "pinned": bool(value)}

    def prune(self, target_mb: int, *, apply: bool = False) -> dict:
        if not isinstance(target_mb, int) or target_mb < 0:
            raise CacheError("Presupuesto inválido")
        with self._lock():
            idx = self._read()
            entries = idx["entries"]
            total = sum(int(v["bytes"]) for v in entries.values())
            target = target_mb * 1024 * 1024
            removable = sorted(
                ((k, v) for k, v in entries.items() if not v.get("pinned", False)),
                key=lambda x: (float(x[1].get("last_used", 0)), x[0]),
            )
            chosen = []
            remaining = total
            for digest, item in removable:
                if remaining <= target:
                    break
                chosen.append(digest)
                remaining -= int(item["bytes"])
            # Reject unexpected local file changes BEFORE any destructive operation.
            if apply:
                for digest in chosen:
                    self._verified(digest)
                for digest in chosen:
                    self._file(digest).unlink()
                    del entries[digest]
                self._save(idx)
            return {
                "dry_run": not apply, "current_bytes": total,
                "target_bytes": target, "planned_sha256": chosen,
                "remaining_bytes": remaining, "target_reachable": remaining <= target,
            }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="EDUAI SSD GGUF cache (offline)")
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    sub = parser.add_subparsers(dest="action", required=True)
    imp = sub.add_parser("import")
    imp.add_argument("--path", type=Path, required=True)
    imp.add_argument("--model-id", required=True)
    imp.add_argument("--expected-sha256", required=True)
    imp.add_argument("--pin", action="store_true")
    imp.add_argument("--quantization", default="unspecified",
                     help="Por ejemplo PTQ1_0, PQ2_0, Q2_0, Q4_K_M")
    sub.add_parser("list")
    verify = sub.add_parser("verify")
    verify.add_argument("--sha256", required=True)
    for op in ("pin", "unpin"):
        cmd = sub.add_parser(op)
        cmd.add_argument("--sha256", required=True)
    prune = sub.add_parser("prune")
    prune.add_argument("--target-mb", type=int, required=True)
    prune.add_argument("--apply", action="store_true",
                       help="Eliminar exclusivamente artefactos no fijados; por defecto solo simular")
    args = parser.parse_args(argv)
    store = ArtifactStore(args.cache_dir)
    try:
        if args.action == "import":
            result = store.add(args.path, args.model_id, args.expected_sha256, pin=args.pin, quantization=args.quantization)
        elif args.action == "list":
            result = {"entries": store.list()}
        elif args.action == "verify":
            result = store.verify(args.sha256)
        elif args.action in ("pin", "unpin"):
            result = store.pin(args.sha256, args.action == "pin")
        else:
            result = store.prune(args.target_mb, apply=args.apply)
    except (CacheError, OSError, ValueError, KeyError, TypeError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2
    print(json.dumps({"ok": True, "result": result}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
