import json
import os
import tempfile
import uuid
from pathlib import Path

import gradio as gr
import requests
import soundfile as sf
import spaces
import torch
import torchaudio
from diffusers import AceStepPipeline

MODEL_ID = os.getenv("ACE_STEP_MODEL_ID", "ACE-Step/acestep-v15-xl-turbo-diffusers")
OUTPUT_DIR = Path(os.getenv("SONG_OUTPUT_DIR", "/tmp/eduai-songs"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ZeroGPU emula CUDA durante el arranque. Cargar el modelo aquí permite que el
# movimiento a GPU sea optimizado cuando se ejecuta la función decorada.
pipe = AceStepPipeline.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.bfloat16,
)
pipe.vae.enable_tiling()
pipe = pipe.to("cuda")


def _clean_text(value: str, limit: int) -> str:
    return " ".join(str(value or "").replace("\x00", " ").split())[:limit]


def _download_reference(url: str):
    if not url:
        return None

    response = requests.get(url, timeout=30)
    response.raise_for_status()

    suffix = ".wav"
    content_type = (response.headers.get("content-type") or "").lower()
    if "mpeg" in content_type or "mp3" in content_type:
        suffix = ".mp3"
    elif "flac" in content_type:
        suffix = ".flac"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
        handle.write(response.content)
        source_path = handle.name

    try:
        waveform, sample_rate = torchaudio.load(source_path)
        waveform = waveform.float()
        if sample_rate != 48000:
            waveform = torchaudio.functional.resample(waveform, sample_rate, 48000)
        if waveform.shape[0] == 1:
            waveform = waveform.repeat(2, 1)
        elif waveform.shape[0] > 2:
            waveform = waveform[:2]
        max_samples = 48000 * 30
        waveform = waveform[:, :max_samples]
        return waveform
    finally:
        try:
            os.remove(source_path)
        except OSError:
            pass


def _duration_budget(
    prompt,
    lyrics,
    duration,
    bpm,
    key_scale,
    time_signature,
    vocal_language,
    instrumental,
    vocal_style,
    reference_audio_url,
    seed,
):
    seconds = max(10, min(180, int(float(duration or 45))))
    return max(90, min(240, seconds * 3))


@spaces.GPU(duration=_duration_budget, size="large")
def generate_song(
    prompt: str,
    lyrics: str,
    duration: float,
    bpm: float,
    key_scale: str,
    time_signature: str,
    vocal_language: str,
    instrumental: bool,
    vocal_style: str,
    reference_audio_url: str,
    seed: float,
):
    caption = _clean_text(prompt, 1800)
    song_lyrics = str(lyrics or "").strip()[:8000]
    seconds = max(10.0, min(180.0, float(duration or 45)))
    tempo = int(bpm) if bpm and float(bpm) > 0 else None
    key = _clean_text(key_scale, 40)
    signature = str(time_signature or "4").strip()
    language = _clean_text(vocal_language or "es", 16)
    style = _clean_text(vocal_style or "automatic", 120)
    numeric_seed = int(seed) if seed and float(seed) >= 0 else int.from_bytes(os.urandom(4), "big")

    if not caption:
        raise gr.Error("La descripción musical está vacía")

    if instrumental:
        song_lyrics = ""
        caption = f"{caption}. Instrumental, no vocals."
    elif style and style != "automatic":
        caption = f"{caption}. Lead singing voice: {style}. Vocal language: {language}."

    generator = torch.Generator(device="cuda").manual_seed(numeric_seed)
    reference = _download_reference(str(reference_audio_url or "").strip())

    params = {
        "prompt": caption,
        "lyrics": song_lyrics,
        "audio_duration": seconds,
        "num_inference_steps": 8,
        "generator": generator,
    }
    if tempo:
        params["bpm"] = tempo
    if key:
        params["keyscale"] = key
    if signature in {"2", "3", "4", "6"}:
        params["timesignature"] = signature

    voice_reference_used = reference is not None and not instrumental
    if voice_reference_used:
        params.update({
            "task_type": "cover",
            "reference_audio": reference.to("cuda", dtype=torch.float32),
            "audio_cover_strength": 0.68,
        })

    output = pipe(**params)
    audio = output.audios[0]
    if hasattr(audio, "detach"):
        audio = audio.detach().cpu().float().numpy()

    if audio.ndim == 2:
        audio_for_file = audio.T
    else:
        audio_for_file = audio

    file_name = f"eduai-song-{uuid.uuid4().hex}.wav"
    file_path = OUTPUT_DIR / file_name
    sf.write(file_path, audio_for_file, pipe.sample_rate, subtype="PCM_16")

    metadata = {
        "model": MODEL_ID,
        "seed": numeric_seed,
        "duration": seconds,
        "bpm": tempo,
        "key_scale": key,
        "time_signature": signature,
        "vocal_language": language,
        "instrumental": bool(instrumental),
        "vocal_style": style,
        "voice_reference_used": voice_reference_used,
        "sample_rate": pipe.sample_rate,
        "format": "wav",
    }

    return str(file_path), json.dumps(metadata, ensure_ascii=False)


def health():
    return {
        "ok": True,
        "model": MODEL_ID,
        "provider": "ACE-Step 1.5",
        "gpu": "ZeroGPU",
    }


with gr.Blocks(title="EduAI Song Engine") as demo:
    gr.Markdown(
        """
        # 🎵 EduAI Song Engine
        Motor privado de canciones para Audio Lab. La interfaz principal de uso está en EduAI.
        """
    )

    with gr.Row():
        with gr.Column(scale=2):
            prompt_input = gr.Textbox(label="Descripción musical", lines=4)
            lyrics_input = gr.Textbox(label="Letra", lines=10)
            vocal_style_input = gr.Textbox(label="Estilo de voz", value="automatic")
            reference_input = gr.Textbox(label="URL temporal de voz autorizada", type="password")
        with gr.Column(scale=1):
            duration_input = gr.Slider(10, 180, value=45, step=5, label="Duración")
            bpm_input = gr.Number(value=0, label="BPM (0 = automático)")
            key_input = gr.Textbox(value="", label="Tonalidad")
            signature_input = gr.Dropdown(["2", "3", "4", "6"], value="4", label="Compás")
            language_input = gr.Textbox(value="es", label="Idioma")
            instrumental_input = gr.Checkbox(value=False, label="Instrumental")
            seed_input = gr.Number(value=-1, label="Semilla (-1 = aleatoria)")

    generate_button = gr.Button("Generar canción", variant="primary")
    audio_output = gr.Audio(label="Canción generada", type="filepath")
    metadata_output = gr.Textbox(label="Metadatos")

    generate_button.click(
        fn=generate_song,
        inputs=[
            prompt_input,
            lyrics_input,
            duration_input,
            bpm_input,
            key_input,
            signature_input,
            language_input,
            instrumental_input,
            vocal_style_input,
            reference_input,
            seed_input,
        ],
        outputs=[audio_output, metadata_output],
        api_name="generate_song",
    )

    gr.Button("Estado del motor").click(
        fn=health,
        inputs=[],
        outputs=gr.JSON(label="Estado"),
        api_name="health",
    )

if __name__ == "__main__":
    demo.queue(default_concurrency_limit=1, max_size=20).launch()
