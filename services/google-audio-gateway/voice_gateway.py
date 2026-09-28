import asyncio
import base64
import hashlib
import json
import os
import subprocess
import tempfile
import time
import wave
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx
from fastapi import Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
VOICE_MODEL = os.getenv("VOICE_MODEL", "gemini-3.8-flash-tts")


class ProfileRequest(BaseModel):
    profile_id: str = Field(min_length=10, max_length=100)


class RenderRequest(ProfileRequest):
    text: str = Field(min_length=1, max_length=900)


def sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Token de EduAI requerido")
    return authorization[7:].strip()


def auth_headers(token: str) -> dict[str, str]:
    return {"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"}


async def current_user(token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers=auth_headers(token))
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Sesión de EduAI inválida")
    return response.json()


async def get_profile(token: str, profile_id: str) -> dict[str, Any]:
    params = {"id": f"eq.{profile_id}", "select": "*", "limit": "1"}
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/audio_voice_profiles",
            headers=auth_headers(token),
            params=params,
        )
    if response.status_code >= 300:
        raise RuntimeError(f"Supabase no pudo leer el perfil ({response.status_code})")
    rows = response.json()
    if not rows:
        raise RuntimeError("Perfil vocal no encontrado")
    return rows[0]


async def patch_profile(token: str, profile_id: str, payload: dict[str, Any]) -> None:
    headers = {
        **auth_headers(token),
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.patch(
            f"{SUPABASE_URL}/rest/v1/audio_voice_profiles",
            headers=headers,
            params={"id": f"eq.{profile_id}"},
            json=payload,
        )
    if response.status_code >= 300:
        raise RuntimeError(f"Supabase no pudo actualizar el perfil ({response.status_code})")


async def add_event(
    token: str,
    user_id: str,
    profile_id: str,
    event_type: str,
    metadata: dict[str, Any],
) -> None:
    headers = {
        **auth_headers(token),
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    payload = {
        "user_id": user_id,
        "voice_profile_id": profile_id,
        "event_type": event_type,
        "metadata": metadata,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        await client.post(
            f"{SUPABASE_URL}/rest/v1/audio_voice_events",
            headers=headers,
            json=payload,
        )


async def storage_download(token: str, bucket: str, path: str) -> bytes:
    encoded = "/".join(quote(part, safe="") for part in path.split("/"))
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.get(
            f"{SUPABASE_URL}/storage/v1/object/authenticated/{bucket}/{encoded}",
            headers=auth_headers(token),
        )
    if response.status_code >= 300:
        raise RuntimeError(f"No se pudo abrir audio privado ({response.status_code})")
    return response.content


async def storage_upload(token: str, bucket: str, path: str, data: bytes, mime: str) -> None:
    encoded = "/".join(quote(part, safe="") for part in path.split("/"))
    headers = {
        **auth_headers(token),
        "Content-Type": mime,
        "x-upsert": "true",
        "cache-control": "3600",
    }
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/{bucket}/{encoded}",
            headers=headers,
            content=data,
        )
    if response.status_code >= 300:
        raise RuntimeError(f"No se pudo guardar archivo privado ({response.status_code}): {response.text[:400]}")


def suffix_for(path: str) -> str:
    extension = Path(path).suffix.lower()
    return extension if extension in {".wav", ".mp3", ".m4a", ".webm", ".ogg", ".flac"} else ".bin"


def normalize_wav(data: bytes, suffix: str) -> tuple[bytes, float]:
    with tempfile.TemporaryDirectory(prefix="eduai-voice-") as directory:
        source = Path(directory) / f"source{suffix}"
        output = Path(directory) / "normalized.wav"
        source.write_bytes(data)
        completed = subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(source),
                "-ac",
                "1",
                "-ar",
                "24000",
                "-sample_fmt",
                "s16",
                str(output),
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if completed.returncode != 0 or not output.exists():
            raise RuntimeError("No se pudo normalizar el audio: " + completed.stderr[-400:])

        normalized = output.read_bytes()
        with wave.open(str(output), "rb") as wav:
            duration = wav.getnframes() / float(wav.getframerate())
        return normalized, duration


async def gemini_create_voice(display_name: str, source: bytes, consent: bytes) -> dict[str, Any]:
    payload = {
        "store": True,
        "voice": {
            "model": VOICE_MODEL,
            "type": "replicated",
            "display_name": display_name[:80],
            "replicated": {
                "source_audio": {
                    "mime_type": "audio/wav",
                    "data": base64.b64encode(source).decode(),
                },
                "consent_audio": {
                    "mime_type": "audio/wav",
                    "data": base64.b64encode(consent).decode(),
                },
            },
        },
    }
    headers = {"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(connect=20, read=300, write=120, pool=20)) as client:
        response = await client.post(
            "https://generativelanguage.googleapis.com/v1beta/voices",
            headers=headers,
            json=payload,
        )
    if response.status_code >= 300:
        raise RuntimeError(f"Gemini Voice Replication respondió {response.status_code}: {response.text[:1200]}")
    result = response.json()
    voice_id = result.get("id") or (result.get("voice") or {}).get("id")
    if not voice_id:
        raise RuntimeError("Google no devolvió un identificador de voz")
    return result


async def gemini_delete_voice(voice_id: str) -> None:
    if not voice_id.startswith("voice_"):
        return
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.delete(
            f"https://generativelanguage.googleapis.com/v1beta/voices/{quote(voice_id, safe='')}",
            headers={"x-goog-api-key": GEMINI_API_KEY},
        )
    if response.status_code not in {200, 204, 404}:
        raise RuntimeError(f"No se pudo borrar la voz de Google ({response.status_code})")


async def gemini_render(voice_id: str, text: str) -> tuple[bytes, str]:
    payload = {
        "model": VOICE_MODEL,
        "input": [{
            "type": "user_input",
            "content": [{
                "type": "text",
                "text": text,
                "annotations": [{
                    "type": "speech_metadata",
                    "style": "natural, clear and conversational",
                }],
            }],
        }],
        "response_format": {"type": "audio"},
        "generation_config": {
            "speech_config": [{"voice": voice_id}],
        },
    }
    headers = {"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(connect=20, read=300, write=30, pool=20)) as client:
        response = await client.post(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            headers=headers,
            json=payload,
        )
    if response.status_code >= 300:
        raise RuntimeError(f"Gemini TTS respondió {response.status_code}: {response.text[:1200]}")

    result = response.json()
    for step in result.get("steps") or []:
        if step.get("type") != "model_output":
            continue
        for item in step.get("content") or []:
            if item.get("type") == "audio" and item.get("data"):
                return base64.b64decode(item["data"]), item.get("mime_type") or "audio/wav"
    raise RuntimeError("Gemini TTS terminó sin audio")


async def save_model_asset(token: str, user_id: str, profile_id: str, voice_id: str) -> None:
    path = f"{user_id}/{profile_id}/google/current.json"
    descriptor = json.dumps({
        "provider": "google-gemini",
        "engine": VOICE_MODEL,
        "voice_id": voice_id,
        "storage_mode": "stateful",
        "ttl": "1 year",
    }, ensure_ascii=False).encode("utf-8")
    await storage_upload(token, "voice-model-assets", path, descriptor, "application/json")

    headers = {
        **auth_headers(token),
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    payload = {
        "user_id": user_id,
        "voice_profile_id": profile_id,
        "engine": VOICE_MODEL,
        "engine_version": "2026-09",
        "asset_type": "voice_id",
        "storage_bucket": "voice-model-assets",
        "storage_path": path,
        "metadata": {
            "provider": "google-gemini",
            "voice_id": voice_id,
            "storage_mode": "stateful",
            "ttl": "1 year",
        },
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{SUPABASE_URL}/rest/v1/audio_voice_model_assets",
            headers=headers,
            params={"on_conflict": "voice_profile_id,engine,engine_version,asset_type"},
            json=payload,
        )
    if response.status_code >= 300:
        raise RuntimeError(f"No se pudo registrar el adaptador vocal ({response.status_code})")


async def voice_health() -> dict[str, Any]:
    return {
        "ok": True,
        "provider": "google-gemini-api",
        "model": VOICE_MODEL,
        "scale_to_zero": True,
    }


async def voice_diagnostics() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            "https://generativelanguage.googleapis.com/v1beta/voices",
            headers={"x-goog-api-key": GEMINI_API_KEY},
            params={"pageSize": "1"},
        )
    return {
        "ok": response.status_code == 200,
        "status": response.status_code,
        "model": VOICE_MODEL,
        "detail": "available" if response.status_code == 200 else response.text[:500],
    }


async def prepare_voice(body: ProfileRequest, authorization: str | None = Header(default=None)):
    token = bearer(authorization)
    user = await current_user(token)
    profile = await get_profile(token, body.profile_id)
    if profile.get("user_id") != user.get("id"):
        raise HTTPException(status_code=403, detail="Perfil no autorizado")

    async def stream():
        try:
            source_path = profile.get("sample_path")
            consent_path = profile.get("consent_audio_path")
            if not source_path:
                raise RuntimeError("Falta la muestra vocal de referencia")
            if not consent_path:
                raise RuntimeError("Falta la grabación obligatoria de consentimiento")
            if not profile.get("consent_confirmed") or not profile.get("authorization_confirmed"):
                raise RuntimeError("El perfil no tiene autorización verificable")

            await patch_profile(token, body.profile_id, {
                "status": "processing",
                "processing_progress": 8,
                "processing_stage": "connecting_google",
                "processing_error": None,
                "model_provider": "google-gemini-voice-replication",
                "internal_use_enabled": False,
            })
            await add_event(token, user["id"], body.profile_id, "processing_started", {
                "provider": "google-gemini",
                "engine": VOICE_MODEL,
            })
            yield sse("progress", {
                "progress": 8,
                "stage": "connecting_google",
                "label": "Conectando con Google Voice Replication",
            })

            source_task = asyncio.create_task(storage_download(token, "voice-clones", source_path))
            consent_task = asyncio.create_task(storage_download(token, "voice-clones", consent_path))
            source_raw, consent_raw = await asyncio.gather(source_task, consent_task)

            yield sse("progress", {
                "progress": 24,
                "stage": "normalizing_audio",
                "label": "Normalizando muestras a WAV mono de 24 kHz",
            })
            source_wav, source_seconds = await asyncio.to_thread(normalize_wav, source_raw, suffix_for(source_path))
            consent_wav, consent_seconds = await asyncio.to_thread(normalize_wav, consent_raw, suffix_for(consent_path))

            if not 10 <= source_seconds <= 30:
                raise RuntimeError(
                    f"La muestra de referencia debe durar entre 10 y 30 segundos; dura {source_seconds:.1f} s"
                )
            if not 2 <= consent_seconds <= 30:
                raise RuntimeError("La grabación de consentimiento no tiene una duración válida")

            canonical_path = f"{user['id']}/{body.profile_id}/canonical/reference.wav"
            await storage_upload(token, "voice-clones", canonical_path, source_wav, "audio/wav")
            source_sha256 = hashlib.sha256(source_wav).hexdigest()

            yield sse("progress", {
                "progress": 42,
                "stage": "verifying_consent",
                "label": "Verificando hablante y consentimiento",
            })

            old_voice_id = profile.get("provider_voice_id")
            if old_voice_id:
                await gemini_delete_voice(old_voice_id)
                await patch_profile(token, body.profile_id, {"provider_voice_id": None})

            task = asyncio.create_task(
                gemini_create_voice(profile.get("display_name") or "EduAI Voice", source_wav, consent_wav)
            )
            progress = 52
            yield sse("progress", {
                "progress": progress,
                "stage": "replicating_voice",
                "label": "Gemini está creando el perfil vocal",
            })

            while not task.done():
                await asyncio.sleep(2)
                progress = min(88, progress + 3)
                yield sse("progress", {
                    "progress": progress,
                    "stage": "replicating_voice",
                    "label": "Analizando características vocales",
                })

            result = await task
            voice_id = result.get("id") or (result.get("voice") or {}).get("id")
            yield sse("progress", {
                "progress": 92,
                "stage": "saving_voice",
                "label": "Guardando voz reutilizable",
            })

            await save_model_asset(token, user["id"], body.profile_id, voice_id)
            now_epoch = time.time()
            now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now_epoch))
            expires_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now_epoch + 365 * 24 * 60 * 60))

            await patch_profile(token, body.profile_id, {
                "status": "ready",
                "processing_progress": 100,
                "processing_stage": "ready",
                "processing_error": None,
                "model_provider": "google-gemini-voice-replication",
                "provider_voice_id": voice_id,
                "provider_voice_expires_at": expires_at,
                "internal_use_enabled": True,
                "canonical_audio_path": canonical_path,
                "canonical_audio_mime": "audio/wav",
                "canonical_sample_rate": 24000,
                "canonical_duration_seconds": round(source_seconds, 3),
                "source_sha256": source_sha256,
                "processed_at": now,
                "updated_at": now,
            })
            await add_event(token, user["id"], body.profile_id, "ready", {
                "provider": "google-gemini",
                "engine": VOICE_MODEL,
                "voice_id": voice_id,
                "source_seconds": round(source_seconds, 2),
                "consent_seconds": round(consent_seconds, 2),
            })
            yield sse("complete", {
                "progress": 100,
                "stage": "ready",
                "label": "Voz lista",
                "profile_id": body.profile_id,
                "voice_id": voice_id,
            })
        except Exception as exc:
            message = str(exc)[:1500]
            try:
                await patch_profile(token, body.profile_id, {
                    "status": "draft",
                    "processing_progress": 100,
                    "processing_stage": "failed",
                    "processing_error": message,
                    "internal_use_enabled": False,
                })
                await add_event(token, user["id"], body.profile_id, "disabled_internal", {
                    "provider": "google-gemini",
                    "reason": "processing_failed",
                    "error": message[:500],
                })
            except Exception:
                pass
            yield sse("error", {"progress": 100, "stage": "failed", "error": message})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


async def render_voice(body: RenderRequest, authorization: str | None = Header(default=None)):
    token = bearer(authorization)
    user = await current_user(token)
    profile = await get_profile(token, body.profile_id)
    if profile.get("user_id") != user.get("id"):
        raise HTTPException(status_code=403, detail="Perfil no autorizado")

    async def stream():
        try:
            voice_id = profile.get("provider_voice_id")
            if profile.get("status") != "ready" or not voice_id or not profile.get("internal_use_enabled"):
                raise RuntimeError("La voz todavía no está lista")

            yield sse("progress", {
                "progress": 12,
                "stage": "connecting_google",
                "label": "Conectando con Gemini TTS",
            })

            task = asyncio.create_task(gemini_render(voice_id, body.text.strip()))
            progress = 28
            yield sse("progress", {
                "progress": progress,
                "stage": "generating_voice",
                "label": "Generando audio con la voz replicada",
            })

            while not task.done():
                await asyncio.sleep(1.5)
                progress = min(86, progress + 5)
                yield sse("progress", {
                    "progress": progress,
                    "stage": "generating_voice",
                    "label": "Sintetizando voz",
                })

            audio, mime = await task
            yield sse("progress", {
                "progress": 92,
                "stage": "saving_audio",
                "label": "Guardando audio privado",
            })

            render_id = f"{int(time.time() * 1000)}"
            extension = "wav" if "wav" in mime else "mp3"
            path = f"{user['id']}/{body.profile_id}/{render_id}.{extension}"
            await storage_upload(token, "generated-voice-audio", path, audio, mime)

            now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            await patch_profile(token, body.profile_id, {
                "last_used_at": now,
                "updated_at": now,
            })
            await add_event(token, user["id"], body.profile_id, "used", {
                "provider": "google-gemini",
                "engine": VOICE_MODEL,
                "text_chars": len(body.text),
            })

            yield sse("complete", {
                "progress": 100,
                "stage": "completed",
                "label": "Audio listo",
                "bucket": "generated-voice-audio",
                "audio_path": path,
            })
        except Exception as exc:
            yield sse("error", {
                "progress": 100,
                "stage": "failed",
                "error": str(exc)[:1500],
            })

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


async def delete_voice(body: ProfileRequest, authorization: str | None = Header(default=None)):
    token = bearer(authorization)
    user = await current_user(token)
    profile = await get_profile(token, body.profile_id)
    if profile.get("user_id") != user.get("id"):
        raise HTTPException(status_code=403, detail="Perfil no autorizado")

    voice_id = profile.get("provider_voice_id")
    if voice_id:
        await gemini_delete_voice(voice_id)
    return {"ok": True}
