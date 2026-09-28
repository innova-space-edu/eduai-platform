import asyncio
import base64
import json
import os
import time
from typing import Any

import httpx
from fastapi import Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
LYRIA_MODEL = os.getenv("LYRIA_MODEL", "lyria-3.5")


class SongRequest(BaseModel):
    job_id: str = Field(min_length=10, max_length=100)


def sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Token de EduAI requerido")
    return authorization[7:].strip()


def auth_headers(token: str) -> dict[str, str]:
    return {"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"}


async def user_context(token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers=auth_headers(token))
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Sesión de EduAI inválida")
    return response.json()


async def db_get_job(token: str, job_id: str) -> dict[str, Any]:
    params = {"id": f"eq.{job_id}", "select": "*", "limit": "1"}
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/audio_song_jobs",
            headers=auth_headers(token),
            params=params,
        )
    if response.status_code >= 300:
        raise RuntimeError(f"Supabase no pudo leer el trabajo ({response.status_code})")
    rows = response.json()
    if not rows:
        raise RuntimeError("Trabajo de canción no encontrado")
    return rows[0]


async def db_update_job(token: str, job_id: str, payload: dict[str, Any]) -> None:
    headers = {
        **auth_headers(token),
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.patch(
            f"{SUPABASE_URL}/rest/v1/audio_song_jobs",
            headers=headers,
            params={"id": f"eq.{job_id}"},
            json=payload,
        )
    if response.status_code >= 300:
        raise RuntimeError(f"Supabase no pudo actualizar el trabajo ({response.status_code})")


def build_prompt(job: dict[str, Any]) -> str:
    meta = job.get("metadata") or {}
    sections = [
        "Create an original full song. Do not imitate a living artist or an existing copyrighted song.",
        f"Language: {job.get('vocal_language') or 'es'}.",
        f"Target duration: approximately {int(job.get('duration_seconds') or 60)} seconds.",
    ]
    if job.get("genre"):
        sections.append(f"Genre/style: {job['genre']}.")
    if job.get("mood"):
        sections.append(f"Mood: {job['mood']}.")
    if job.get("bpm"):
        sections.append(f"Tempo: around {job['bpm']} BPM.")
    if job.get("key_scale"):
        sections.append(f"Key: {job['key_scale']}.")
    if job.get("time_signature"):
        sections.append(f"Time signature: {job['time_signature']}/4.")
    if meta.get("vocal_style_prompt"):
        sections.append(f"Vocal direction: {meta['vocal_style_prompt']}.")

    if job.get("instrumental"):
        sections.append("Instrumental only. Do not include vocals or spoken words.")
    elif job.get("lyrics"):
        sections.extend([
            "Use these user-provided lyrics. Preserve their wording as much as musically possible:",
            str(job["lyrics"]),
        ])

    brief = job.get("caption") or job.get("prompt")
    if brief:
        sections.append(f"Production brief: {brief}")

    return "\n\n".join(sections)


async def call_lyria(prompt: str) -> dict[str, Any]:
    headers = {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
    }
    body = {
        "model": LYRIA_MODEL,
        "input": prompt,
        "response_format": {"type": "audio"},
    }
    timeout = httpx.Timeout(connect=20, read=900, write=30, pool=20)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            headers=headers,
            json=body,
        )
    if response.status_code >= 300:
        raise RuntimeError(f"Lyria respondió {response.status_code}: {response.text[:1200]}")
    return response.json()


def extract_audio(interaction: dict[str, Any]) -> tuple[bytes, str]:
    for step in interaction.get("steps") or []:
        if step.get("type") != "model_output":
            continue
        for item in step.get("content") or []:
            if item.get("type") != "audio":
                continue
            data = item.get("data")
            if data:
                return base64.b64decode(data), item.get("mime_type") or "audio/mpeg"
    raise RuntimeError("Lyria terminó sin un bloque de audio")


async def upload_song(token: str, user_id: str, job_id: str, audio: bytes, mime: str) -> str:
    extension = "mp3" if "mpeg" in mime or "mp3" in mime else "wav"
    path = f"{user_id}/{job_id}/song.{extension}"
    headers = {
        **auth_headers(token),
        "Content-Type": mime,
        "x-upsert": "true",
        "cache-control": "3600",
    }
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/generated-songs/{path}",
            headers=headers,
            content=audio,
        )
    if response.status_code >= 300:
        raise RuntimeError(f"No se pudo guardar el audio ({response.status_code}): {response.text[:500]}")
    return path


async def song_health() -> dict[str, Any]:
    return {
        "ok": True,
        "provider": "google-gemini-api",
        "model": LYRIA_MODEL,
        "scale_to_zero": True,
    }


async def song_diagnostics() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            f"https://generativelanguage.googleapis.com/v1beta/models/{LYRIA_MODEL}",
            headers={"x-goog-api-key": GEMINI_API_KEY},
        )
    return {
        "ok": response.status_code == 200,
        "status": response.status_code,
        "model": LYRIA_MODEL,
        "detail": "available" if response.status_code == 200 else response.text[:500],
    }


async def run_song(payload: SongRequest, authorization: str | None = Header(default=None)):
    token = bearer(authorization)
    user = await user_context(token)
    job = await db_get_job(token, payload.job_id)
    if job.get("user_id") != user.get("id"):
        raise HTTPException(status_code=403, detail="Trabajo no autorizado")

    async def stream():
        started = time.monotonic()
        meta = job.get("metadata") or {}
        try:
            await db_update_job(token, payload.job_id, {
                "status": "generating",
                "progress": 12,
                "provider": "google-lyria-3.5",
                "metadata": {**meta, "stage": "connecting_google_ai"},
            })
            yield sse("progress", {
                "progress": 12,
                "stage": "connecting_google_ai",
                "label": "Conectando con Google AI",
            })

            yield sse("progress", {
                "progress": 20,
                "stage": "preparing_lyria",
                "label": "Preparando Lyria 3.5",
            })

            task = asyncio.create_task(call_lyria(build_prompt(job)))
            progress = 28
            yield sse("progress", {
                "progress": progress,
                "stage": "generating_music",
                "label": "Lyria 3.5 está componiendo la canción",
            })

            while not task.done():
                await asyncio.sleep(2.5)
                estimated = min(88, 28 + int((time.monotonic() - started) / 3.5))
                if estimated > progress:
                    progress = estimated
                    yield sse("progress", {
                        "progress": progress,
                        "stage": "generating_music",
                        "label": "Lyria 3.5 está generando voces, instrumentos y estructura",
                    })

            interaction = await task
            yield sse("progress", {
                "progress": 91,
                "stage": "decoding_audio",
                "label": "Procesando audio generado",
            })

            audio, mime = extract_audio(interaction)
            if len(audio) < 5000:
                raise RuntimeError("Lyria devolvió un archivo de audio incompleto")

            await db_update_job(token, payload.job_id, {
                "status": "uploading",
                "progress": 95,
                "metadata": {
                    **meta,
                    "stage": "saving_audio",
                    "lyria_interaction_id": interaction.get("id"),
                    "lyria_model": interaction.get("model") or LYRIA_MODEL,
                },
            })
            yield sse("progress", {
                "progress": 95,
                "stage": "saving_audio",
                "label": "Guardando en tu biblioteca privada",
            })

            audio_path = await upload_song(token, user["id"], payload.job_id, audio, mime)
            completed_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            await db_update_job(token, payload.job_id, {
                "status": "completed",
                "progress": 100,
                "audio_path": audio_path,
                "provider": "google-lyria-3.5",
                "error": None,
                "completed_at": completed_at,
                "updated_at": completed_at,
                "metadata": {
                    **meta,
                    "stage": "completed",
                    "lyria_interaction_id": interaction.get("id"),
                    "lyria_model": interaction.get("model") or LYRIA_MODEL,
                    "mime": mime,
                },
            })
            yield sse("complete", {
                "progress": 100,
                "stage": "completed",
                "label": "Canción lista",
                "job_id": payload.job_id,
                "bucket": "generated-songs",
                "audio_path": audio_path,
            })
        except Exception as exc:
            message = str(exc)[:1500]
            try:
                await db_update_job(token, payload.job_id, {
                    "status": "failed",
                    "progress": 100,
                    "error": message,
                    "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "metadata": {**meta, "stage": "failed"},
                })
            except Exception:
                pass
            yield sse("error", {
                "progress": 100,
                "stage": "failed",
                "error": message,
            })

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
