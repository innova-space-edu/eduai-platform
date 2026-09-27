import spaces  # ZeroGPU debe inicializarse antes de torch.

import base64
import hashlib
import io
import os
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

import gradio as gr
import librosa
import requests
import soundfile as sf
import torch

OPENVOICE_COMMIT = os.environ.get(
    "OPENVOICE_COMMIT",
    "74a1d147b17a8c3092dd5430504bd83ef6c7eb23",
)
CHECKPOINT_URL = os.environ.get(
    "OPENVOICE_CHECKPOINT_URL",
    "https://myshell-public-repo-host.s3.amazonaws.com/openvoice/checkpoints_v2_0417.zip",
)
ROOT = Path(__file__).resolve().parent
VENDOR_DIR = ROOT / ".vendor"
CHECKPOINT_DIR = ROOT / "checkpoints_v2"
MAX_REFERENCE_BYTES = 15 * 1024 * 1024
MAX_SOURCE_BYTES = 5 * 1024 * 1024


def _download_bytes(url: str, max_bytes: int) -> tuple[bytes, str]:
    if not url.startswith(("https://", "http://")):
        raise ValueError("URL de audio inválida")
    response = requests.get(url, timeout=45, stream=True, allow_redirects=True)
    response.raise_for_status()
    output = io.BytesIO()
    total = 0
    for chunk in response.iter_content(chunk_size=256 * 1024):
        if not chunk:
            continue
        total += len(chunk)
        if total > max_bytes:
            raise ValueError("La muestra vocal excede el tamaño permitido")
        output.write(chunk)
    data = output.getvalue()
    if len(data) < 1_000:
        raise ValueError("La muestra vocal está vacía o incompleta")
    return data, str(response.headers.get("content-type") or "").split(";", 1)[0].lower()


def _ensure_openvoice_source() -> None:
    marker = VENDOR_DIR / "openvoice" / "openvoice" / "api.py"
    if marker.exists():
        sys.path.insert(0, str(VENDOR_DIR / "openvoice"))
        return

    VENDOR_DIR.mkdir(parents=True, exist_ok=True)
    archive_url = f"https://github.com/myshell-ai/OpenVoice/archive/{OPENVOICE_COMMIT}.zip"
    response = requests.get(archive_url, timeout=60)
    response.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        archive.extractall(VENDOR_DIR)

    extracted = VENDOR_DIR / f"OpenVoice-{OPENVOICE_COMMIT}"
    target = VENDOR_DIR / "openvoice"
    if target.exists():
        shutil.rmtree(target)
    extracted.rename(target)
    sys.path.insert(0, str(target))


def _ensure_checkpoints() -> None:
    converter_config = CHECKPOINT_DIR / "converter" / "config.json"
    converter_ckpt = CHECKPOINT_DIR / "converter" / "checkpoint.pth"
    if converter_config.exists() and converter_ckpt.exists():
        return

    response = requests.get(CHECKPOINT_URL, timeout=120)
    response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        archive.extractall(ROOT)

    if not converter_config.exists() or not converter_ckpt.exists():
        raise RuntimeError("No se pudieron preparar los checkpoints de OpenVoice V2")


_ensure_openvoice_source()
_ensure_checkpoints()

from openvoice.api import ToneColorConverter  # noqa: E402

DEVICE = "cuda:0"
converter = ToneColorConverter(
    str(CHECKPOINT_DIR / "converter" / "config.json"),
    device=DEVICE,
    enable_watermark=False,
)
converter.load_ckpt(str(CHECKPOINT_DIR / "converter" / "checkpoint.pth"))


def _write_audio_file(data: bytes, mime: str, directory: str, stem: str) -> str:
    mime = (mime or "").lower().split(";", 1)[0]
    if "mpeg" in mime or "mp3" in mime:
        extension = ".mp3"
    elif "mp4" in mime or "m4a" in mime:
        extension = ".m4a"
    elif "webm" in mime:
        extension = ".webm"
    elif "ogg" in mime:
        extension = ".ogg"
    else:
        extension = ".wav"
    path = os.path.join(directory, f"{stem}{extension}")
    with open(path, "wb") as handle:
        handle.write(data)
    return path


def _audio_duration(path: str) -> float:
    audio, sr = librosa.load(path, sr=None, mono=True)
    if sr <= 0 or audio.size == 0:
        raise ValueError("No se pudo leer la muestra vocal")
    return float(audio.size / sr)


def _extract_embedding(path: str):
    # Usamos directamente el extractor del convertidor. Para muestras cortas y
    # limpias evita cargar Whisper/VAD, reduce dependencias y conserva privacidad.
    return converter.extract_se([path])


@spaces.GPU(duration=120)
def prepare_voice(reference_audio_url: str) -> dict:
    """Valida una muestra privada y comprueba que OpenVoice V2 puede extraer su timbre."""
    try:
        reference_bytes, reference_mime = _download_bytes(str(reference_audio_url or ""), MAX_REFERENCE_BYTES)
        with tempfile.TemporaryDirectory(prefix="eduai-openvoice-") as tmp:
            reference_path = _write_audio_file(reference_bytes, reference_mime, tmp, "reference")
            duration = _audio_duration(reference_path)
            if duration < 2.0:
                raise ValueError("La muestra vocal debe durar al menos 2 segundos")
            if duration > 60.0:
                raise ValueError("La muestra vocal debe durar como máximo 60 segundos para el perfil")

            embedding = _extract_embedding(reference_path)
            if embedding is None or int(embedding.numel()) <= 0:
                raise ValueError("OpenVoice no pudo extraer el timbre de la muestra")

            digest = hashlib.sha256(reference_bytes).hexdigest()[:16]
            return {
                "ok": True,
                "engine": "OpenVoice V2",
                "mode": "zero-shot-tone-color",
                "sample_seconds": round(duration, 2),
                "sample_hash": digest,
                "persistent_biometric_storage": False,
            }
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:500], "engine": "OpenVoice V2"}


@spaces.GPU(duration=180)
def convert_voice(reference_audio_url: str, source_audio_base64: str, source_mime: str):
    """Convierte una voz base de EduAI al timbre autorizado de la muestra privada."""
    try:
        reference_bytes, reference_mime = _download_bytes(str(reference_audio_url or ""), MAX_REFERENCE_BYTES)
        source_bytes = base64.b64decode(str(source_audio_base64 or ""), validate=True)
        if len(source_bytes) < 500:
            raise ValueError("El audio base está vacío")
        if len(source_bytes) > MAX_SOURCE_BYTES:
            raise ValueError("El audio base excede el tamaño permitido")

        with tempfile.TemporaryDirectory(prefix="eduai-openvoice-") as tmp:
            reference_path = _write_audio_file(reference_bytes, reference_mime, tmp, "reference")
            source_path = _write_audio_file(source_bytes, source_mime, tmp, "source")
            output_path = os.path.join(tmp, "cloned.wav")

            target_se = _extract_embedding(reference_path)
            source_se = _extract_embedding(source_path)

            converter.convert(
                audio_src_path=source_path,
                src_se=source_se,
                tgt_se=target_se,
                output_path=output_path,
                tau=0.3,
                message="",
            )

            audio, sr = sf.read(output_path)
            if getattr(audio, "size", 0) <= 0:
                raise ValueError("OpenVoice generó un audio vacío")

            final_path = os.path.join(tempfile.gettempdir(), f"eduai-openvoice-{hashlib.sha256(source_bytes).hexdigest()[:16]}.wav")
            shutil.copyfile(output_path, final_path)

            return final_path, {
                "ok": True,
                "engine": "OpenVoice V2",
                "mode": "tone-color-conversion",
                "sample_rate": int(sr),
                "reference_seconds": round(_audio_duration(reference_path), 2),
                "source_seconds": round(_audio_duration(source_path), 2),
            }
    except Exception as exc:
        raise gr.Error(f"OpenVoice: {str(exc)[:500]}")


with gr.Blocks(title="EduAI OpenVoice V2") as demo:
    gr.Markdown(
        "# EduAI · OpenVoice V2\n"
        "Servicio privado ZeroGPU para preparar y probar voces autorizadas. "
        "Las muestras llegan mediante URL firmada temporal y no se guardan en el Space."
    )

    with gr.Tab("Preparar voz"):
        reference_url = gr.Textbox(label="URL firmada de muestra")
        prepare_button = gr.Button("Validar muestra")
        prepare_result = gr.JSON(label="Resultado")
        prepare_button.click(
            prepare_voice,
            inputs=[reference_url],
            outputs=[prepare_result],
            api_name="prepare_voice",
        )

    with gr.Tab("Convertir voz"):
        conversion_reference = gr.Textbox(label="URL firmada de muestra")
        source_base64 = gr.Textbox(label="Audio base64", lines=2)
        source_mime = gr.Textbox(label="MIME de audio base", value="audio/mpeg")
        convert_button = gr.Button("Convertir")
        converted_file = gr.File(label="Audio convertido")
        conversion_metadata = gr.JSON(label="Metadatos")
        convert_button.click(
            convert_voice,
            inputs=[conversion_reference, source_base64, source_mime],
            outputs=[converted_file, conversion_metadata],
            api_name="convert_voice",
        )

if __name__ == "__main__":
    demo.queue(default_concurrency_limit=1).launch(mcp_server=True)
