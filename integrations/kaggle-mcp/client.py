"""Kaggle CLI adapter: bounded, non-shell commands and credential-safe output."""
from __future__ import annotations
import csv
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

SLUG_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$")
ROOT = Path(__file__).resolve().parents[2]
SAMPLE_NOTEBOOK = ROOT / "training/eduai-local/kaggle/EDUAI_Model_Factory_Kaggle_Phase1.ipynb"
MAX_DISPLAY = 14000


class KaggleBridgeError(RuntimeError):
    pass


def _redact(value: str) -> str:
    for key in ("KAGGLE_API_TOKEN", "KAGGLE_KEY", "KAGGLE_MCP_BEARER"):
        secret = os.environ.get(key, "")
        if secret:
            value = value.replace(secret, "[REDACTED]")
    return value


def reference(owner: str, slug: str) -> str:
    if not SLUG_RE.fullmatch(owner) or not SLUG_RE.fullmatch(slug):
        raise KaggleBridgeError("El identificador Kaggle debe tener formato propietario/notebook-slug")
    return f"{owner}/{slug}"


def _auth_present() -> bool:
    return bool(
        os.environ.get("KAGGLE_API_TOKEN")
        or (os.environ.get("KAGGLE_USERNAME") and os.environ.get("KAGGLE_KEY"))
        or (Path.home() / ".kaggle" / "access_token").is_file()
        or (Path.home() / ".kaggle" / "kaggle.json").is_file()
    )


def connection_info() -> dict:
    return {
        "service": "Innova Kaggle MCP",
        "cli_installed": shutil.which("kaggle") is not None,
        "credentials_configured": _auth_present(),
        "write_enabled": os.environ.get("KAGGLE_ENABLE_WRITES") == "true",
        "allowed_owner_configured": bool(os.environ.get("KAGGLE_ALLOWED_OWNER")),
        "production_ready": False,
        "notes": "No muestra credenciales ni comprueba acceso remoto; se requiere una llamada autenticada.",
    }


def _run(args: list[str], timeout: int = 50) -> str:
    if shutil.which("kaggle") is None:
        raise KaggleBridgeError("Instala kaggle CLI en el servidor MCP")
    if not _auth_present():
        raise KaggleBridgeError("Configura KAGGLE_API_TOKEN de forma privada en el servidor")
    try:
        completed = subprocess.run(
            ["kaggle", "kernels", *args],
            capture_output=True, text=True, check=False,
            timeout=timeout, env=os.environ.copy(),
        )
    except subprocess.TimeoutExpired as exc:
        raise KaggleBridgeError("La operación de Kaggle agotó el tiempo de espera") from exc
    except OSError as exc:
        raise KaggleBridgeError("No se pudo iniciar Kaggle CLI") from exc
    output = _redact((completed.stdout or "").strip())
    if completed.returncode:
        detail = _redact((completed.stderr or output or "Kaggle devolvió un error").strip())
        raise KaggleBridgeError(f"Kaggle CLI no completó la solicitud: {detail[:1200]}")
    return output[:MAX_DISPLAY]


def my_notebooks(page: int = 1) -> dict:
    if not 1 <= page <= 20:
        raise KaggleBridgeError("La página debe estar entre 1 y 20")
    result = _run(["list", "--mine", "--page", str(page), "--page-size", "20", "--csv"])
    rows = list(csv.DictReader(io.StringIO(result))) if result else []
    return {"page": page, "notebooks": rows[:20]}


def notebook_status(owner: str, slug: str) -> dict:
    target = reference(owner, slug)
    return {"notebook": target, "status": _run(["status", target])}


def notebook_files(owner: str, slug: str) -> dict:
    target = reference(owner, slug)
    output = _run(["files", target, "--csv", "--page-size", "100"])
    rows = list(csv.DictReader(io.StringIO(output))) if output else []
    return {"notebook": target, "files": rows[:100]}


def eduai_report(owner: str, slug: str) -> dict:
    target = reference(owner, slug)
    with tempfile.TemporaryDirectory(prefix="kaggle-report-") as folder:
        _run(
            ["output", target, "-p", folder, "--file-pattern",
             r"^(kaggle-smoke-report|eduai-training-manifest)\.json$"],
            timeout=120,
        )
        found = {}
        for filename in ("kaggle-smoke-report.json", "eduai-training-manifest.json"):
            path = Path(folder) / filename
            if not path.is_file():
                continue
            if path.stat().st_size > 256_000:
                raise KaggleBridgeError("Reporte demasiado grande para consulta MCP")
            found[filename] = json.loads(path.read_text(encoding="utf-8"))
        return {"notebook": target, "reports": found, "found": bool(found)}


def submit_eduai_smoke(owner: str, slug: str, *, confirmed: bool, run_gpu: bool) -> dict:
    """Only publish the audited repository notebook, never arbitrary generated code."""
    target = reference(owner, slug)
    if os.environ.get("KAGGLE_ENABLE_WRITES") != "true":
        raise KaggleBridgeError("Acciones de escritura deshabilitadas en este servidor")
    allowed = os.environ.get("KAGGLE_ALLOWED_OWNER", "")
    if not allowed or owner.casefold() != allowed.casefold():
        raise KaggleBridgeError("Solo se permite publicar notebooks de la cuenta autorizada")
    if confirmed is not True:
        raise KaggleBridgeError("Debes aprobar expresamente la operación antes de enviarla")
    if run_gpu and os.environ.get("KAGGLE_GPU_RUNS_ENABLED") != "true":
        raise KaggleBridgeError("El inicio de GPU no está habilitado en el servidor")
    if not SAMPLE_NOTEBOOK.is_file():
        raise KaggleBridgeError("No está presente el notebook EDUAI verificado en el repositorio")
    with tempfile.TemporaryDirectory(prefix="eduai-kaggle-upload-") as folder:
        notebook_name = SAMPLE_NOTEBOOK.name
        shutil.copy2(SAMPLE_NOTEBOOK, Path(folder) / notebook_name)
        metadata = {
            "id": target, "title": "EDUAI Model Factory Phase 1",
            "code_file": notebook_name, "language": "python",
            "kernel_type": "notebook", "is_private": True,
            "enable_gpu": bool(run_gpu), "enable_internet": True,
            "dataset_sources": [], "competition_sources": [],
            "kernel_sources": [], "model_sources": [],
        }
        (Path(folder) / "kernel-metadata.json").write_text(
            json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
        )
        args = ["push", "-p", folder]
        if run_gpu:
            args.extend(["--accelerator", "NvidiaTeslaT4"])
        else:
            args.append("--no-run")
        response = _run(args, timeout=180)
    return {
        "notebook": target, "submitted": True,
        "gpu_requested": run_gpu, "private": True, "message": response,
        "warning": "El envío aceptado no confirma una ejecución terminada; consulta notebook_status.",
    }
