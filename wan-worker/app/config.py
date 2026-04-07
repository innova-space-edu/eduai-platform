import os
from dataclasses import dataclass


@dataclass
class Settings:
    worker_api_key: str
    comfyui_base_url: str
    comfyui_ws_url: str
    wan_model_name: str
    output_dir: str
    public_base_url: str


def get_settings() -> Settings:
    return Settings(
        worker_api_key=os.getenv("WORKER_API_KEY", "").strip(),
        comfyui_base_url=os.getenv("COMFYUI_BASE_URL", "http://127.0.0.1:8188").strip(),
        comfyui_ws_url=os.getenv("COMFYUI_WS_URL", "ws://127.0.0.1:8188/ws").strip(),
        wan_model_name=os.getenv("WAN_MODEL_NAME", "Wan2.1-T2V-1.3B").strip(),
        output_dir=os.getenv("OUTPUT_DIR", "./outputs").strip(),
        public_base_url=os.getenv("PUBLIC_BASE_URL", "http://127.0.0.1:8000/static").strip(),
    )
