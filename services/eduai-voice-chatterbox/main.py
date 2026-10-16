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


def verify_local_manifest() -> None:
    manifest_file = MODEL_PATH / "manifest.json"
    if not manifest_file.is_file():
        raise RuntimeError("Falta manifest.json del checkpoint Chatterbox")
    manifest = json.loads(manifest_file.read_text())
    hashes = manifest.get("files")
    if not isinstance(hashes, dict) or not all(name in hashes for name in REQUIRED_WEIGHTS):
        raise RuntimeError("Manifiesto de integridad del modelo incompleto")
    for name, expected in hashes.items():
        if not isinstance(name, str) or not isinstance(expected, str) or \
           Path(name).name != name or name.startswith(".") or len(expected) != 64:
            raise RuntimeError("Manifiesto SHA256 inválido")
        src = MODEL_PATH / name
        if not src.is_file():
            raise RuntimeError("Falta checkpoint Chatterbox: " + name)
        digest = hashlib.file_digest(src.open("rb"), "sha256").hexdigest()
        if digest.lower() != expected.lower():
            raise RuntimeError("Hash de checkpoint Chatterbox incorrecto: " + name)


def install_verified_weights() -> None:
    """Prefer a baked, SHA256-verified offline image. GCS is optional."""
    if (MODEL_PATH / "manifest.json").is_file():
        verify_local_manifest()
        return
    if not MODEL_GCS_URI.startswith("gs://"):
        raise RuntimeError("Imagen sin checkpoints y CHATTERBOX_MODEL_GCS_URI no configurado")

    from google.cloud import storage
    bucket_name, _, prefix = MODEL_GCS_URI.removeprefix("gs://").partition("/")
    prefix = prefix.strip("/")
    if not bucket_name or not prefix:
        raise RuntimeError("Ruta del checkpoint en GCS inválida")
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    manifest = json.loads(bucket.blob(f"{prefix}/manifest.json").download_as_text())
    hashes = manifest.get("files")
    if not isinstance(hashes, dict) or not all(name in hashes for name in REQUIRED_WEIGHTS):
        raise RuntimeError("Manifiesto GCS inválido")
    MODEL_PATH.mkdir(parents=True, exist_ok=True)
    for name in hashes:
        if Path(name).name != name or name.startswith("."):
            raise RuntimeError("Nombre de checkpoint inválido")
        bucket.blob(f"{prefix}/{name}").download_to_filename(str(MODEL_PATH / name))
    (MODEL_PATH / "manifest.json").write_text(json.dumps(manifest))
    verify_local_manifest()


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
