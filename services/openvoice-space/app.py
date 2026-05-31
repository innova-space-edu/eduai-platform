from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="EduAI OpenVoice Private Service", version="0.1.0")


class VoiceProcessRequest(BaseModel):
    voice_id: str = Field(min_length=1, max_length=100)


class VoiceSynthesisRequest(BaseModel):
    voice_id: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=4000)
    language: str = "ES"
    speed: float = Field(default=1.0, ge=0.65, le=1.35)


@app.get("/")
def root() -> dict:
    return {
        "ok": True,
        "service": "eduai-openvoice-private",
        "status": "scaffold-online",
    }


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "service": "eduai-openvoice-private",
        "status": "scaffold-online",
        "modelReady": False,
    }


@app.post("/voices/process")
def process_voice(request: VoiceProcessRequest) -> dict:
    raise HTTPException(
        status_code=503,
        detail="OpenVoice runtime not installed yet",
    )


@app.post("/voices/synthesize")
def synthesize_voice(request: VoiceSynthesisRequest) -> dict:
    raise HTTPException(
        status_code=503,
        detail="OpenVoice runtime not installed yet",
    )


@app.delete("/voices/{voice_id}")
def delete_voice(voice_id: str) -> dict:
    return {"ok": True, "voiceId": voice_id}
