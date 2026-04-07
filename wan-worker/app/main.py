from fastapi import FastAPI, Header, HTTPException
from app.config import get_settings
from app.schemas import JobRequest, JobResponse

app = FastAPI(title="Wan Worker API", version="0.1.0")


@app.get("/health")
def health():
    settings = get_settings()
    return {
        "ok": True,
        "service": "wan-worker",
        "model": settings.wan_model_name,
        "comfyui_base_url": settings.comfyui_base_url,
    }


@app.post("/jobs", response_model=JobResponse)
def create_job(
    payload: JobRequest,
    authorization: str | None = Header(default=None),
):
    settings = get_settings()

    expected = f"Bearer {settings.worker_api_key}"

    if not settings.worker_api_key:
        raise HTTPException(status_code=500, detail="WORKER_API_KEY no configurada.")

    if authorization != expected:
        raise HTTPException(status_code=401, detail="No autorizado.")

    if payload.mode == "image_to_video" and not payload.imageUrl:
        raise HTTPException(
            status_code=400,
            detail="imageUrl es obligatoria para image_to_video.",
        )

    return JobResponse(
        ok=False,
        provider="wan-worker",
        model=settings.wan_model_name,
        error="Worker base activo, pero ComfyUI aún no está conectado.",
        raw={
            "phase": "base_api",
            "jobId": payload.jobId,
            "mode": payload.mode,
        },
    )
