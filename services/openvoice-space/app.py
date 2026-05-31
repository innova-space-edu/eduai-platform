from __future__ import annotations

import base64
import hmac
import json
import os
import re
import shutil
import tempfile
from pathlib import Path
from threading import Lock
from typing import Dict, Optional

import torch
from fastapi import Depends, FastAPI, Header, HTTPException
from melo.api import TTS
from openvoice import se_extractor
from openvoice.api import ToneColorConverter
from pydantic import BaseModel, Field

APP_NAME = "eduai-openvoice-private"
SUPPORTED_LANGUAGES = {"EN", "EN_NEWEST", "ES", "FR", "ZH", "JP", "KR"}
VOICE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]+$")
STORE_DIR = Path(os.getenv("VOICE_STORE_DIR", "/data/voices"))
CHECKPOINT_DIR = Path(os.getenv("OPENVOICE_CHECKPOINT_DIR", "/home/user/app/checkpoints_v2"))
CONVERTER_DIR = CHECKPOINT_DIR / "converter"
BASE_SE_DIR = CHECKPOINT_DIR / "base_speakers" / "ses"
SERVICE_TOKEN = os.getenv("VOICE_CLONING_SERVICE_TOKEN", "").strip()
DEVICE = "cuda:0" if torch.cuda.is_available() else "cpu"

STORE_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="EduAI OpenVoice Private Service", version="1.0.0")
_converter: Optional[ToneColorConverter] = None
_models: Dict[str, TTS] = {}
_model_lock = Lock()


class VoiceProcessRequest(BaseModel):
    voice_id: str = Field(min_length=1, max_length=100)
    sample_base64: str = Field(min_length=16)
    mime_type: str = "audio/wav"


class VoiceSynthesisRequest(BaseModel):
    voice_id: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=4000)
    language: str = "ES"
    speed: float = Field(default=1.0, ge=0.65, le=1.35)
    speaker_key: Optional[str] = None


def require_internal_token(x_eduai_audio_token: Optional[str] = Header(default=None)) -> None:
    if not SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="VOICE_CLONING_SERVICE_TOKEN is not configured")
    if not x_eduai_audio_token or not hmac.compare_digest(x_eduai_audio_token, SERVICE_TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized")


def validate_voice_id(voice_id: str) -> str:
    if not VOICE_ID_PATTERN.fullmatch(voice_id):
        raise HTTPException(status_code=400, detail="Invalid voice id")
    return voice_id


def normalize_language(language: str) -> str:
    normalized = (language or "ES").strip().upper()
    if normalized not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {normalized}")
    return normalized


def decode_sample(payload: str) -> bytes:
    encoded = payload.split(",", 1)[-1].strip()
    try:
        raw = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 audio sample") from exc
    if len(raw) < 1024:
        raise HTTPException(status_code=400, detail="Audio sample is too small")
    if len(raw) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio sample exceeds 20 MB")
    return raw


def sample_extension(mime_type: str) -> str:
    lowered = (mime_type or "").lower()
    if "mpeg" in lowered or "mp3" in lowered:
        return ".mp3"
    if "mp4" in lowered or "m4a" in lowered:
        return ".m4a"
    if "ogg" in lowered:
        return ".ogg"
    if "webm" in lowered:
        return ".webm"
    return ".wav"


def get_converter() -> ToneColorConverter:
    global _converter
    if _converter is None:
        config_path = CONVERTER_DIR / "config.json"
        checkpoint_path = CONVERTER_DIR / "checkpoint.pth"
        if not config_path.exists() or not checkpoint_path.exists():
            raise HTTPException(status_code=503, detail="OpenVoice V2 checkpoints are unavailable")
        converter = ToneColorConverter(str(config_path), device=DEVICE)
        converter.load_ckpt(str(checkpoint_path))
        _converter = converter
    return _converter


def get_model(language: str) -> TTS:
    normalized = normalize_language(language)
    with _model_lock:
        model = _models.get(normalized)
        if model is None:
            model = TTS(language=normalized, device=DEVICE)
            _models[normalized] = model
        return model


def voice_dir(voice_id: str) -> Path:
    return STORE_DIR / validate_voice_id(voice_id)


@app.get("/")
def root() -> dict:
    return {
        "ok": True,
        "service": APP_NAME,
        "status": "online",
        "modelReady": (CONVERTER_DIR / "checkpoint.pth").exists(),
    }


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "service": APP_NAME,
        "status": "online",
        "device": DEVICE,
        "modelReady": (CONVERTER_DIR / "checkpoint.pth").exists(),
        "tokenConfigured": bool(SERVICE_TOKEN),
        "storeReady": STORE_DIR.exists(),
        "loadedLanguages": sorted(_models.keys()),
    }


@app.get("/voices/{voice_id}/status", dependencies=[Depends(require_internal_token)])
def voice_status(voice_id: str) -> dict:
    directory = voice_dir(voice_id)
    embedding = directory / "target_se.pth"
    return {
        "ok": True,
        "voiceId": voice_id,
        "ready": embedding.exists(),
        "embeddingRef": f"voices/{voice_id}/target_se.pth" if embedding.exists() else None,
    }


@app.post("/voices/process", dependencies=[Depends(require_internal_token)])
def process_voice(request: VoiceProcessRequest) -> dict:
    converter = get_converter()
    voice_id = validate_voice_id(request.voice_id)
    raw = decode_sample(request.sample_base64)
    final_dir = voice_dir(voice_id)
    staging_dir = Path(tempfile.mkdtemp(prefix=f"{voice_id}-", dir=str(STORE_DIR)))
    sample_path = staging_dir / f"reference{sample_extension(request.mime_type)}"
    sample_path.write_bytes(raw)

    try:
        target_se, _ = se_extractor.get_se(str(sample_path), converter, vad=True)
        embedding_path = staging_dir / "target_se.pth"
        torch.save(target_se, embedding_path)
        (staging_dir / "metadata.json").write_text(
            json.dumps({"voiceId": voice_id, "mimeType": request.mime_type, "provider": "openvoice-v2"}),
            encoding="utf-8",
        )
        if final_dir.exists():
            shutil.rmtree(final_dir)
        staging_dir.rename(final_dir)
    except HTTPException:
        shutil.rmtree(staging_dir, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(staging_dir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=f"Could not process reference voice: {exc}") from exc

    return {
        "ok": True,
        "providerVoiceId": voice_id,
        "embeddingRef": f"voices/{voice_id}/target_se.pth",
        "model": "openvoice-v2",
    }


@app.post("/voices/synthesize", dependencies=[Depends(require_internal_token)])
def synthesize_voice(request: VoiceSynthesisRequest) -> dict:
    converter = get_converter()
    language = normalize_language(request.language)
    target_path = voice_dir(request.voice_id) / "target_se.pth"
    if not target_path.exists():
        raise HTTPException(status_code=404, detail="Processed private voice not found")

    model = get_model(language)
    speaker_ids = model.hps.data.spk2id
    if not speaker_ids:
        raise HTTPException(status_code=503, detail="No MeloTTS speakers available")

    speaker_key = request.speaker_key if request.speaker_key in speaker_ids else next(iter(speaker_ids))
    speaker_id = speaker_ids[speaker_key]
    source_key = speaker_key.lower().replace("_", "-")
    source_path = BASE_SE_DIR / f"{source_key}.pth"
    if not source_path.exists():
        raise HTTPException(status_code=503, detail=f"Missing base speaker embedding: {source_key}")

    with tempfile.TemporaryDirectory(prefix="eduai-openvoice-") as temp_dir:
        temp = Path(temp_dir)
        source_audio = temp / "source.wav"
        output_audio = temp / "output.wav"
        model.tts_to_file(request.text, speaker_id, str(source_audio), speed=request.speed)
        source_se = torch.load(source_path, map_location=DEVICE)
        target_se = torch.load(target_path, map_location=DEVICE)
        converter.convert(
            audio_src_path=str(source_audio),
            src_se=source_se,
            tgt_se=target_se,
            output_path=str(output_audio),
            message="@EduAI",
        )
        encoded = base64.b64encode(output_audio.read_bytes()).decode("ascii")

    return {
        "ok": True,
        "audioBase64": encoded,
        "mime": "audio/wav",
        "provider": "openvoice-v2",
    }


@app.delete("/voices/{voice_id}", dependencies=[Depends(require_internal_token)])
def delete_voice(voice_id: str) -> dict:
    directory = voice_dir(voice_id)
    shutil.rmtree(directory, ignore_errors=True)
    return {"ok": True, "voiceId": voice_id}
