from __future__ import annotations

import base64
import os
import tempfile
import urllib.request
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlparse

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from faster_whisper import WhisperModel

APP_NAME = "EduAI Audio Parser"
PARSER_TOKEN = os.getenv("AUDIO_PARSER_TOKEN", "").strip()
MODEL_NAME = os.getenv("WHISPER_MODEL", "small").strip() or "small"
DEVICE = os.getenv("WHISPER_DEVICE", "cpu").strip() or "cpu"
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8").strip() or "int8"
MAX_FILE_SIZE_MB = int(os.getenv("AUDIO_PARSER_MAX_MB", "50"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

app = FastAPI(title=APP_NAME, version="1.1.0")
_model: WhisperModel | None = None


class PipelineOptions(BaseModel):
    mode: Literal["quick", "pro"] = "quick"
    improveAudio: bool = False
    preciseSubtitles: bool = False
    diarize: bool = False
    detectLanguage: bool = True
    speakerLabels: list[str] = Field(default_factory=list)
    createSummary: bool = False


class PipelineRequest(BaseModel):
    audioBase64: str
    mimeType: str
    fileName: str = "audio.mp3"
    fileSizeBytes: int | None = None
    options: PipelineOptions = Field(default_factory=PipelineOptions)


class PipelineUrlRequest(BaseModel):
    audioUrl: str
    mimeType: str
    fileName: str = "audio.mp3"
    fileSizeBytes: int | None = None
    options: PipelineOptions = Field(default_factory=PipelineOptions)


def _authorize(authorization: str | None) -> None:
    if not PARSER_TOKEN:
        return
    if authorization != f"Bearer {PARSER_TOKEN}":
        raise HTTPException(status_code=401, detail="Token de parser inválido")


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)
    return _model


def _safe_suffix(filename: str, mime_type: str) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix in {".mp3", ".wav", ".m4a", ".mp4", ".webm", ".ogg"}:
        return suffix
    if "wav" in mime_type:
        return ".wav"
    if "mp4" in mime_type or "m4a" in mime_type:
        return ".m4a"
    if "webm" in mime_type:
        return ".webm"
    if "ogg" in mime_type:
        return ".ogg"
    return ".mp3"


def _duration_label(seconds: float) -> str:
    if seconds < 60:
        return f"{round(seconds)} seg"
    return f"{round(seconds / 60)} min"


def _validate_audio_url(audio_url: str) -> None:
    parsed = urlparse(audio_url)
    hostname = (parsed.hostname or "").lower()
    if parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="La URL firmada debe usar HTTPS")
    if not (hostname.endswith(".supabase.co") or hostname.endswith(".supabase.in")):
        raise HTTPException(status_code=400, detail="Solo se aceptan URLs firmadas de Supabase Storage")


def _download_signed_audio(audio_url: str) -> bytes:
    _validate_audio_url(audio_url)
    request = urllib.request.Request(audio_url, headers={"User-Agent": "EduAI-Audio-Parser/1.1"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            content_length = int(response.headers.get("Content-Length") or 0)
            if content_length and content_length > MAX_FILE_SIZE_BYTES:
                raise HTTPException(status_code=413, detail=f"El audio supera el límite de {MAX_FILE_SIZE_MB} MB")
            audio = response.read(MAX_FILE_SIZE_BYTES + 1)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="No se pudo descargar el audio firmado") from exc

    if len(audio) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"El audio supera el límite de {MAX_FILE_SIZE_MB} MB")
    return audio


def _transcribe_audio(audio: bytes, mime_type: str, filename: str, options: PipelineOptions) -> dict[str, Any]:
    if not audio:
        raise HTTPException(status_code=400, detail="El audio está vacío")
    if len(audio) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"El audio supera el límite de {MAX_FILE_SIZE_MB} MB")

    suffix = _safe_suffix(filename, mime_type)
    with tempfile.TemporaryDirectory(prefix="eduai-audio-") as temp_dir:
        audio_path = Path(temp_dir) / f"input{suffix}"
        audio_path.write_bytes(audio)

        model = _get_model()
        word_timestamps = options.mode == "pro" or options.preciseSubtitles
        segments_gen, info = model.transcribe(
            str(audio_path),
            beam_size=5 if options.mode == "pro" else 3,
            vad_filter=True,
            word_timestamps=word_timestamps,
            condition_on_previous_text=True,
        )

        segments: list[dict[str, Any]] = []
        transcript_parts: list[str] = []
        max_end = 0.0

        for index, segment in enumerate(segments_gen):
            text = str(segment.text or "").strip()
            if not text:
                continue
            start = float(segment.start or 0)
            end = float(segment.end or start)
            max_end = max(max_end, end)
            transcript_parts.append(text)

            row: dict[str, Any] = {
                "id": f"seg_{index + 1}",
                "start": start,
                "end": end,
                "text": text,
            }

            if word_timestamps and getattr(segment, "words", None):
                row["words"] = [
                    {
                        "word": str(word.word or ""),
                        "start": float(word.start or 0),
                        "end": float(word.end or 0),
                        "confidence": float(word.probability) if word.probability is not None else None,
                    }
                    for word in segment.words
                ]

            segments.append(row)

    transcript = " ".join(transcript_parts).strip()
    if not transcript:
        raise HTTPException(status_code=422, detail="No se detectó voz útil en el archivo")

    language = str(getattr(info, "language", "es") or "es")
    probability = float(getattr(info, "language_probability", 0) or 0)

    return {
        "transcript": transcript,
        "transcriptClean": transcript,
        "language": language,
        "durationEstimate": _duration_label(max_end),
        "qualityNotes": f"Faster Whisper {MODEL_NAME} · VAD · idioma {language} ({probability:.2f})",
        "provider": "external",
        "mode": options.mode,
        "speakers": [],
        "segments": segments,
        "summary": "",
        "metadata": {
            "model": MODEL_NAME,
            "device": DEVICE,
            "computeType": COMPUTE_TYPE,
            "segmentCount": len(segments),
            "wordLevelTimestamps": word_timestamps,
            "diarizationApplied": False,
            "improveAudioApplied": False,
        },
        "modelUsed": f"faster-whisper-{MODEL_NAME}",
    }


@app.get("/")
def root() -> dict[str, Any]:
    return {"ok": True, "service": APP_NAME, "endpoints": ["/health", "/pipeline", "/pipeline-url"]}


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": APP_NAME,
        "model": MODEL_NAME,
        "device": DEVICE,
        "computeType": COMPUTE_TYPE,
        "maxFileSizeMB": MAX_FILE_SIZE_MB,
        "tokenRequired": bool(PARSER_TOKEN),
    }


@app.post("/pipeline")
def run_pipeline(payload: PipelineRequest, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _authorize(authorization)
    try:
        audio = base64.b64decode(payload.audioBase64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="audioBase64 inválido") from exc
    return _transcribe_audio(audio, payload.mimeType, payload.fileName, payload.options)


@app.post("/pipeline-url")
def run_pipeline_url(payload: PipelineUrlRequest, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _authorize(authorization)
    audio = _download_signed_audio(payload.audioUrl)
    return _transcribe_audio(audio, payload.mimeType, payload.fileName, payload.options)
