from typing import Optional, Literal, Any
from pydantic import BaseModel, Field


VideoMode = Literal["text_to_video", "image_to_video"]


class JobRequest(BaseModel):
    jobId: Optional[str] = None
    prompt: str = Field(..., min_length=8, max_length=2000)
    style: Optional[str] = ""
    duration: int = Field(default=6, ge=2, le=10)
    withAudio: bool = False
    mode: VideoMode = "text_to_video"
    imageUrl: Optional[str] = None


class JobResponse(BaseModel):
    ok: bool
    provider: Optional[str] = None
    model: Optional[str] = None
    videoUrl: Optional[str] = None
    thumbnailUrl: Optional[str] = None
    error: Optional[str] = None
    raw: Optional[Any] = None
