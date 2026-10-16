"""Private, offline-from-HF Chatterbox Multilingual V3 voice inference.

Only Cloud Run IAM-authorized callers may reach this application. The calling
EDUAI gateway validates user role, MFA, ownership and consent; this server
never contacts Hugging Face or the Gemini Voice Replication API.
"""
import asyncio
import base64
import hashlib
import io
import json
import os
import tempfile
import wave
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

MODEL_PATH = Path(os.getenv("CHATTERBOX_MODEL_PATH", "/models/chatterbox-v3"))
MODEL_GCS_URI = os.getenv("CHATTERBOX_MODEL_GCS_URI", "")
REQUIRED_WEIGHTS = (
    "ve.pt",
    "s3gen.pt",
    "t3_mtl23ls_v3.safetensors",
    "grapheme_mtl_merged_expanded_v1.json",
)
_model = None
_generation_lock = asyncio.Lock()


def install_verified_weights() -> None:
    """Copy owner-supplied, SHA256-verified weights from GCS, never from HF."""
    if not MODEL_GCS_URI.startswith("gs://"):
        raise RuntimeError("CHATTERBOX_MODEL_GCS_URI debe señalar un bucket de modelos verificados")
    from google.cloud import storage

    bucket_name, _, prefix = MODEL_GCS_URI.removeprefix("gs://").partition("/")
    prefix = prefix.strip("/")
    if not bucket_name or not prefix:
        raise RuntimeError("Ruta de checkpoint de GCS inválida")
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    manifest_blob = bucket.blob(f"{prefix}/manifest.json")
    manifest = json.loads(manifest_blob.download_as_text())
    hashes = manifest.get("files")
    if not isinstance(hashes, dict) or not all(name in hashes for name in REQUIRED_WEIGHTS):
        raise RuntimeError("Falta el manifiesto de integridad o algún archivo del modelo")
    MODEL_PATH.mkdir(parents=True, exist_ok=True)
    for name, expected in hashes.items():
        if not isinstance(name, str) or not isinstance(expected, str) or \
           Path(name).name != name or name.startswith(".") or len(expected) != 64:
            raise RuntimeError("Manifiesto SHA256 inválido")
        file_path = MODEL_PATH / name
        if file_path.is_file() and hashlib.sha256(file_path.read_bytes()).hexdigest() == expected.lower():
            continue
        bucket.blob(f"{prefix}/{name}").download_to_filename(str(file_path))
        if hashlib.sha256(file_path.read_bytes()).hexdigest() != expected.lower():
            file_path.unlink(missing_ok=True)
            raise RuntimeError("Integridad del checkpoint incorrecta")
    if not all((MODEL_PATH / name).is_file() for name in REQUIRED_WEIGHTS):
        raise RuntimeError("Checkpoint de Chatterbox incompleto")


def initialize() -> None:
    global _model
    if _model is not None:
        return
    import torch
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    if not torch.cuda.is_available():
        raise RuntimeError("El motor de Chatterbox requiere GPU NVIDIA CUDA")
    install_verified_weights()
    # from_local does not call snapshot_download/hf_hub_download.
    _model = ChatterboxMultilingualTTS.from_local(
        ckpt_dir=MODEL_PATH, device="cuda", t3_model="v3",
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Fail closed: Cloud Run does not become Ready until model assets are valid.
    await asyncio.to_thread(initialize)
    yield


app = FastAPI(title="EDUAI Chatterbox private GPU", lifespan=lifespan, docs_url=None, redoc_url=None)


class SynthesisRequest(BaseModel):
    reference_wav_b64: str = Field(min_length=100, max_length=6_000_000)
    text: str = Field(min_length=1, max_length=900)
    language_id: str = Field(default="es", pattern=r"^es$")


@app.get("/health")
async def health():
    return {"ok": _model is not None, "engine": "chatterbox-multilingual-v3", "gpu": "nvidia"}


def generate_audio(reference: bytes, text: str) -> bytes:
    import torch
    import torchaudio

    if len(reference) > 3_000_000:
        raise ValueError("La referencia supera el tamaño permitido")
    with wave.open(io.BytesIO(reference), "rb") as audio:
        duration = audio.getnframes() / audio.getframerate()
        if (audio.getnchannels(), audio.getframerate(), audio.getsampwidth()) != (1, 24_000, 2):
            raise ValueError("La referencia debe ser WAV mono PCM16 de 24 kHz")
        if not 10 <= duration <= 30:
            raise ValueError("La referencia debe durar entre 10 y 30 segundos")

    with tempfile.NamedTemporaryFile(suffix=".wav") as src:
        src.write(reference)
        src.flush()
        with torch.inference_mode():
            result = _model.generate(text, language_id="es", audio_prompt_path=src.name)
        with io.BytesIO() as wav:
            torchaudio.save(wav, result.detach().cpu(), _model.sr, format="wav", encoding="PCM_S", bits_per_sample=16)
            data = wav.getvalue()
            if len(data) > 15_000_000:
                raise ValueError("Salida demasiado larga; divide el texto")
            return data


@app.post("/v1/synthesize")
async def synthesize(body: SynthesisRequest):
    try:
        ref = base64.b64decode(body.reference_wav_b64, validate=True)
        if len(ref) > 3_000_000:
            raise ValueError("La referencia supera el tamaño permitido")
    except (ValueError, base64.binascii.Error):
        raise HTTPException(400, "Audio de referencia inválido")
    async with _generation_lock:
        try:
            output = await asyncio.to_thread(generate_audio, ref, body.text)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        except Exception as exc:
            # Do not leak raw voice or inference stacktraces.
            raise HTTPException(503, "El motor local no pudo sintetizar la voz") from exc
    return Response(output, media_type="audio/wav", headers={"Cache-Control": "private, no-store"})
