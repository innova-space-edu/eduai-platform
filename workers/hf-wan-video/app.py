import os
import tempfile
from functools import lru_cache

import gradio as gr
import spaces
import torch
from diffusers import WanPipeline
from diffusers.utils import export_to_video

MODEL_ID = os.getenv("WAN_MODEL_ID", "Wan-AI/Wan2.1-T2V-1.3B-Diffusers")


@lru_cache(maxsize=1)
def get_pipeline():
    pipe = WanPipeline.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16)
    pipe.enable_model_cpu_offload()
    return pipe


def _size(aspect_ratio: str, resolution: str):
    # El modelo 1.3B está orientado a 480p/720p moderado. Priorizamos memoria y tiempo.
    if resolution == "1080p":
        return (832, 480) if aspect_ratio != "9:16" else (480, 832)
    return (832, 480) if aspect_ratio != "9:16" else (480, 832)


@spaces.GPU(duration=120)
def generate(prompt, style, duration, mode, image_url, aspect_ratio, resolution):
    if mode == "image_to_video":
        raise gr.Error(
            "Este worker Wan 2.1 1.3B es texto→video. EduAI debe continuar con el siguiente proveedor para imagen→video."
        )

    clean_prompt = " ".join(str(prompt or "").split()).strip()
    if len(clean_prompt) < 8:
        raise gr.Error("El prompt debe tener al menos 8 caracteres.")

    clean_style = " ".join(str(style or "").split()).strip()
    if clean_style:
        clean_prompt = f"{clean_prompt}. Visual style: {clean_style}."

    seconds = max(2, min(8, int(round(float(duration or 4)))))
    width, height = _size(str(aspect_ratio or "16:9"), str(resolution or "720p"))

    # 16 fps aprox.; se limita para no consumir GPU innecesariamente.
    num_frames = max(33, min(81, seconds * 16 + 1))

    pipe = get_pipeline()
    output = pipe(
        prompt=clean_prompt,
        negative_prompt=(
            "blurry, low quality, distorted anatomy, deformed objects, text artifacts, watermark"
        ),
        width=width,
        height=height,
        num_frames=num_frames,
        guidance_scale=5.0,
        num_inference_steps=int(os.getenv("WAN_INFERENCE_STEPS", "30")),
    )

    frames = output.frames[0]
    output_path = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
    export_to_video(frames, output_path, fps=16)
    return output_path


with gr.Blocks(title="EduAI Wan Video Worker") as demo:
    gr.Markdown("# EduAI Wan Video Worker\nWorker de texto→video para EduAI.")

    with gr.Row():
        with gr.Column():
            prompt = gr.Textbox(label="Prompt", lines=5)
            style = gr.Textbox(label="Estilo", value="")
            duration = gr.Slider(2, 8, value=4, step=1, label="Duración")
            mode = gr.Dropdown(
                ["text_to_video", "image_to_video"],
                value="text_to_video",
                label="Modo",
            )
            image_url = gr.Textbox(label="Image URL", value="", visible=False)
            aspect_ratio = gr.Dropdown(["16:9", "9:16"], value="16:9", label="Formato")
            resolution = gr.Dropdown(["720p", "1080p"], value="720p", label="Resolución")
            submit = gr.Button("Generar")
        video = gr.Video(label="Resultado")

    submit.click(
        generate,
        inputs=[prompt, style, duration, mode, image_url, aspect_ratio, resolution],
        outputs=video,
        api_name="generate",
    )

if __name__ == "__main__":
    demo.queue(default_concurrency_limit=1).launch()
