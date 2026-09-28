import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from song_gateway import (
    SongRequest,
    run_song,
    song_diagnostics,
    song_health,
)
from voice_gateway import (
    ProfileRequest,
    RenderRequest,
    delete_voice,
    prepare_voice,
    render_voice,
    voice_diagnostics,
    voice_health,
)

ALLOWED_ORIGINS = [
    value.strip()
    for value in os.getenv(
        "EDUAI_ALLOWED_ORIGINS",
        "https://eduaiplatformclon.vercel.app",
    ).split(",")
    if value.strip()
]

app = FastAPI(title="EduAI Google Audio Gateway", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["authorization", "content-type"],
)

@app.get("/health")
async def health():
    return {
        "ok": True,
        "service": "eduai-google-audio-gateway",
        "song": await song_health(),
        "voice": await voice_health(),
    }

@app.get("/diagnostics/lyria")
async def diagnostics_lyria():
    return await song_diagnostics()

@app.get("/diagnostics/voice")
async def diagnostics_voice():
    return await voice_diagnostics()

app.post("/v1/song/run")(run_song)
app.post("/v1/voice/prepare")(prepare_voice)
app.post("/v1/voice/render")(render_voice)
app.post("/v1/voice/delete")(delete_voice)
