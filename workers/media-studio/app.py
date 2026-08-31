from __future__ import annotations

import json
import mimetypes
import os
import pathlib
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from typing import Any
from urllib.parse import quote

import requests
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
WORKER_SECRET = os.environ.get("MEDIA_RENDER_WORKER_SECRET", "")
BUCKET = os.environ.get("MEDIA_STUDIO_BUCKET", "media-studio")
POLL_SECONDS = max(2, int(os.environ.get("MEDIA_WORKER_POLL_SECONDS", "8")))
ENABLE_POLLING = os.environ.get("MEDIA_WORKER_POLL", "1") not in {"0", "false", "False"}

app = FastAPI(title="EDUAI Media Studio Worker", version="1.0")


class RunRequest(BaseModel):
    kind: str | None = None
    exportId: str | None = None
    projectId: str | None = None
    jobId: str | None = None


def ensure_config() -> None:
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
    if not shutil.which("ffmpeg"):
        raise RuntimeError("FFmpeg no está instalado en el worker")


def headers(prefer: str | None = None) -> dict[str, str]:
    result = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        result["Prefer"] = prefer
    return result


def table_get(table: str, query: str) -> list[dict[str, Any]]:
    response = requests.get(f"{SUPABASE_URL}/rest/v1/{table}?{query}", headers=headers(), timeout=30)
    response.raise_for_status()
    return response.json()


def table_patch(table: str, match: str, payload: dict[str, Any]) -> None:
    response = requests.patch(
        f"{SUPABASE_URL}/rest/v1/{table}?{match}",
        headers=headers("return=minimal"),
        data=json.dumps(payload),
        timeout=30,
    )
    response.raise_for_status()


def table_insert(table: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=headers("return=representation"),
        data=json.dumps(payload),
        timeout=30,
    )
    response.raise_for_status()
    rows = response.json()
    return rows[0] if rows else None


def storage_url(path: str, authenticated: bool = True) -> str:
    encoded = quote(path, safe="/")
    mode = "authenticated" if authenticated else "public"
    return f"{SUPABASE_URL}/storage/v1/object/{mode}/{BUCKET}/{encoded}"


def storage_download(path: str, destination: pathlib.Path) -> None:
    response = requests.get(
        storage_url(path),
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"},
        stream=True,
        timeout=300,
    )
    response.raise_for_status()
    with destination.open("wb") as handle:
        for chunk in response.iter_content(1024 * 1024):
            if chunk:
                handle.write(chunk)


def storage_upload(path: str, source: pathlib.Path, content_type: str | None = None) -> None:
    mime = content_type or mimetypes.guess_type(source.name)[0] or "application/octet-stream"
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{quote(path, safe='/')}"
    with source.open("rb") as handle:
        response = requests.post(
            url,
            headers={
                "apikey": SERVICE_KEY,
                "Authorization": f"Bearer {SERVICE_KEY}",
                "Content-Type": mime,
                "x-upsert": "false",
            },
            data=handle,
            timeout=600,
        )
    response.raise_for_status()


def run(command: list[str], timeout: int = 7200) -> None:
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout)
    if result.returncode != 0:
        tail = "\n".join(result.stderr.splitlines()[-25:])
        raise RuntimeError(tail or f"Comando falló: {' '.join(command)}")


def safe_slug(value: str) -> str:
    clean = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in value.lower())
    return "-".join(part for part in clean.split("-") if part)[:80] or "media"


def update_export(export_id: str, **values: Any) -> None:
    table_patch("media_exports", f"id=eq.{export_id}", values)


def update_processing(job_id: str, **values: Any) -> None:
    table_patch("media_processing_jobs", f"id=eq.{job_id}", values)


def ffmpeg_scale(resolution: str) -> str | None:
    if resolution == "720p":
        return "scale='min(1280,iw)':-2"
    if resolution == "1080p":
        return "scale='min(1920,iw)':-2"
    if resolution == "4k":
        return "scale='min(3840,iw)':-2"
    return None


def process_export(export_id: str) -> None:
    ensure_config()
    rows = table_get("media_exports", f"id=eq.{export_id}&select=*")
    if not rows:
        raise RuntimeError("Export no encontrado")
    job = rows[0]
    metadata = job.get("metadata") or {}
    source_path = metadata.get("sourcePath") or metadata.get("masterPath")
    if not source_path:
        raise RuntimeError("El render no tiene masterPath. Genera el master desde Media Studio antes de convertir.")

    update_export(export_id, status="rendering", error_message=None)
    user_id = str(job["user_id"])
    project_id = str(job["project_id"])
    fmt = str(job.get("format") or "mp4").lower()
    resolution = str(job.get("resolution") or "1080p").lower()

    with tempfile.TemporaryDirectory(prefix="eduai-render-") as temp_dir:
        temp = pathlib.Path(temp_dir)
        source = temp / "master.webm"
        storage_download(str(source_path), source)
        output = temp / f"output.{fmt}"

        if fmt == "mp4":
            command = ["ffmpeg", "-y", "-i", str(source)]
            scale = ffmpeg_scale(resolution)
            if scale:
                command += ["-vf", scale]
            command += [
                "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(output),
            ]
        elif fmt == "mp3":
            command = ["ffmpeg", "-y", "-i", str(source), "-vn", "-c:a", "libmp3lame", "-b:a", "192k", str(output)]
        elif fmt == "wav":
            command = ["ffmpeg", "-y", "-i", str(source), "-vn", "-c:a", "pcm_s16le", "-ar", "48000", str(output)]
        elif fmt == "webm":
            command = ["ffmpeg", "-y", "-i", str(source), "-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-c:a", "libopus", str(output)]
        else:
            raise RuntimeError(f"Formato no soportado: {fmt}")

        run(command)
        path = f"{user_id}/{project_id}/exports/{export_id}.{fmt}"
        storage_upload(path, output)
        update_export(
            export_id,
            status="done",
            storage_path=path,
            completed_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            metadata={**metadata, "sourcePath": source_path, "worker": "ffmpeg", "bytes": output.stat().st_size},
        )


def insert_output_asset(job: dict[str, Any], path: str, name: str, asset_type: str, mime: str, metadata: dict[str, Any]) -> None:
    table_insert("media_assets", {
        "user_id": job["user_id"],
        "project_id": job.get("project_id"),
        "asset_type": asset_type,
        "name": name,
        "source": "generated",
        "provider": "EDUAI Media Worker",
        "storage_path": path,
        "mime_type": mime,
        "license": "Derivado del contenido del usuario",
        "metadata": metadata,
    })


def process_media_job(job_id: str) -> None:
    ensure_config()
    rows = table_get("media_processing_jobs", f"id=eq.{job_id}&select=*")
    if not rows:
        raise RuntimeError("Trabajo de procesamiento no encontrado")
    job = rows[0]
    operation = str(job["operation"])
    params = job.get("parameters") or {}
    source_path = str(job["input_storage_path"])
    user_id = str(job["user_id"])
    project_id = str(job.get("project_id") or "library")
    input_name = str(params.get("inputName") or "media")

    update_processing(job_id, status="processing", progress=0.05, error_message=None, started_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))

    with tempfile.TemporaryDirectory(prefix="eduai-process-") as temp_dir:
        temp = pathlib.Path(temp_dir)
        source = temp / pathlib.Path(source_path).name
        storage_download(source_path, source)
        update_processing(job_id, progress=0.2)
        outputs: list[str] = []

        if operation == "proxy":
            output = temp / "proxy.mp4"
            run([
                "ffmpeg", "-y", "-i", str(source),
                "-vf", "scale='min(1280,iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "27",
                "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(output),
            ])
            path = f"{user_id}/{project_id}/processed/{job_id}-proxy.mp4"
            storage_upload(path, output, "video/mp4")
            outputs.append(path)
            insert_output_asset(job, path, f"Proxy · {input_name}", "video", "video/mp4", {"processingJobId": job_id, "proxyForAssetId": job.get("asset_id")})

        elif operation in {"denoise", "normalize"}:
            output = temp / f"{operation}.wav"
            if operation == "denoise":
                audio_filter = "highpass=f=70,lowpass=f=16000,afftdn=nf=-25,loudnorm=I=-16:TP=-1.5:LRA=11"
            else:
                audio_filter = "loudnorm=I=-16:TP=-1.5:LRA=11"
            run(["ffmpeg", "-y", "-i", str(source), "-vn", "-af", audio_filter, "-c:a", "pcm_s16le", "-ar", "48000", str(output)])
            path = f"{user_id}/{project_id}/processed/{job_id}-{operation}.wav"
            storage_upload(path, output, "audio/wav")
            outputs.append(path)
            label = "Audio limpio" if operation == "denoise" else "Audio normalizado"
            insert_output_asset(job, path, f"{label} · {input_name}", "audio", "audio/wav", {"processingJobId": job_id, "derivedFromAssetId": job.get("asset_id"), "operation": operation})

        elif operation == "extract_audio":
            output = temp / "audio.mp3"
            run(["ffmpeg", "-y", "-i", str(source), "-vn", "-c:a", "libmp3lame", "-b:a", "192k", str(output)])
            path = f"{user_id}/{project_id}/processed/{job_id}-audio.mp3"
            storage_upload(path, output, "audio/mpeg")
            outputs.append(path)
            insert_output_asset(job, path, f"Audio extraído · {input_name}", "audio", "audio/mpeg", {"processingJobId": job_id, "derivedFromAssetId": job.get("asset_id")})

        elif operation == "stems":
            if not shutil.which("python"):
                raise RuntimeError("Python no disponible para Demucs")
            demucs_dir = temp / "demucs"
            mode = str(params.get("mode") or "4")
            command = ["python", "-m", "demucs.separate", "-n", str(params.get("model") or "htdemucs"), "-o", str(demucs_dir)]
            if mode == "vocals":
                command += ["--two-stems", "vocals"]
            command.append(str(source))
            try:
                run(command, timeout=10800)
            except Exception as error:
                raise RuntimeError(f"Demucs no está disponible o falló: {error}") from error

            wavs = sorted(demucs_dir.rglob("*.wav"))
            if not wavs:
                raise RuntimeError("Demucs no generó stems")
            for stem in wavs:
                stem_name = safe_slug(stem.stem)
                path = f"{user_id}/{project_id}/processed/{job_id}-{stem_name}.wav"
                storage_upload(path, stem, "audio/wav")
                outputs.append(path)
                insert_output_asset(job, path, f"Stem {stem.stem} · {input_name}", "audio", "audio/wav", {"processingJobId": job_id, "derivedFromAssetId": job.get("asset_id"), "stem": stem.stem, "model": params.get("model") or "htdemucs"})
        else:
            raise RuntimeError(f"Operación no soportada: {operation}")

        update_processing(job_id, progress=0.95)
        update_processing(
            job_id,
            status="done",
            progress=1,
            output_storage_paths=outputs,
            completed_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        )


def fail_export(export_id: str, error: Exception) -> None:
    update_export(export_id, status="error", error_message=str(error)[:2000], completed_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))


def fail_processing(job_id: str, error: Exception) -> None:
    update_processing(job_id, status="error", error_message=str(error)[:2000], completed_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))


def run_one(kind: str, identifier: str) -> None:
    if kind == "export":
        try:
            process_export(identifier)
        except Exception as error:
            try:
                fail_export(identifier, error)
            finally:
                raise
    else:
        try:
            process_media_job(identifier)
        except Exception as error:
            try:
                fail_processing(identifier, error)
            finally:
                raise


def polling_loop() -> None:
    while True:
        try:
            ensure_config()
            export_rows = table_get("media_exports", "status=eq.queued&order=created_at.asc&limit=1&select=id,metadata")
            if export_rows and (export_rows[0].get("metadata") or {}).get("sourcePath"):
                run_one("export", str(export_rows[0]["id"]))
                continue
            process_rows = table_get("media_processing_jobs", "status=eq.queued&order=created_at.asc&limit=1&select=id")
            if process_rows:
                run_one("processing", str(process_rows[0]["id"]))
                continue
        except Exception as error:
            print(f"[media-worker] polling error: {error}", flush=True)
        time.sleep(POLL_SECONDS)


@app.on_event("startup")
def startup() -> None:
    if ENABLE_POLLING:
        threading.Thread(target=polling_loop, daemon=True, name="media-worker-poll").start()


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "ffmpeg": bool(shutil.which("ffmpeg")),
        "demucs": bool(shutil.which("python")),
        "supabaseConfigured": bool(SUPABASE_URL and SERVICE_KEY),
        "polling": ENABLE_POLLING,
    }


@app.post("/run")
def execute(payload: RunRequest, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if WORKER_SECRET and authorization != f"Bearer {WORKER_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if payload.exportId:
        identifier = payload.exportId
        kind = "export"
    elif payload.jobId:
        identifier = payload.jobId
        kind = "processing"
    else:
        raise HTTPException(status_code=400, detail="Falta exportId o jobId")

    def background() -> None:
        try:
            run_one(kind, identifier)
        except Exception as error:
            print(f"[media-worker] {kind} {identifier} failed: {error}", flush=True)

    threading.Thread(target=background, daemon=True).start()
    return {"ok": True, "accepted": True, "kind": kind, "id": identifier}
