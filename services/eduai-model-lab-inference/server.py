"""EDUAI Model Lab real PEFT inference: private, read-only, one adapter loaded at a time.

The backend NEVER executes arbitrary user code, pulls adapters from request URLs,
or loads an unapproved R5 checkpoint. Its only model IDs are an explicit allowlist.
"""
from __future__ import annotations
import asyncio
import gc
import json
import os
import secrets
import threading
import time
from pathlib import Path
from typing import Any
from fastapi import FastAPI, HTTPException, Request

app = FastAPI(title="EDUAI Nano/Lite Inference", docs_url=None, redoc_url=None, openapi_url=None)
ROOT = Path(os.getenv("EDUAI_MODEL_LAB_MODELS_DIR", "/models"))
BASES = {
    "nano-r2": ("LiquidAI/LFM2.5-350M", None),
    "lite-r2": ("LiquidAI/LFM2.5-1.2B-Instruct", "b9d816ab510f9a28dca37cb182e9da8b0226e13c"),
    "nano-r5": ("LiquidAI/LFM2.5-350M", None),
    "lite-r5": ("LiquidAI/LFM2.5-1.2B-Instruct", "b9d816ab510f9a28dca37cb182e9da8b0226e13c"),
}
_MODEL_LOCK = threading.RLock()
_ACTIVE: dict[str, Any] = {}

def check_token(request: Request) -> None:
    expected = os.getenv("EDUAI_MODEL_LAB_TOKEN", "").strip()
    actual = request.headers.get("authorization", "")
    if not expected or not secrets.compare_digest(actual, "Bearer " + expected):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")

def model_dir(model_id: str) -> Path:
    if model_id not in BASES:
        raise HTTPException(status_code=400, detail="UNKNOWN_MODEL")
    if model_id.endswith("-r5") and os.getenv("EDUAI_MODEL_LAB_R5_APPROVED") != "true":
        raise HTTPException(status_code=403, detail="R5_NOT_APPROVED")
    return ROOT / model_id

def available(model_id: str) -> bool:
    try:
        folder = model_dir(model_id)
        return folder.is_dir() and (folder / "adapter_config.json").is_file() and \
            (folder / "adapter_model.safetensors").is_file()
    except HTTPException:
        return False

def parse_payload(payload: Any) -> tuple[str, list[dict[str, str]], int]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="INVALID_PAYLOAD")
    model = payload.get("model")
    if not isinstance(model, str) or model not in BASES:
        raise HTTPException(status_code=422, detail="UNKNOWN_MODEL")
    if not available(model):
        raise HTTPException(status_code=404, detail="ADAPTER_NOT_READY")
    messages = payload.get("messages")
    if not isinstance(messages, list) or not 1 <= len(messages) <= 9:
        raise HTTPException(status_code=422, detail="INVALID_MESSAGES")
    safe: list[dict[str, str]] = []
    user_count = 0
    for entry in messages:
        if not isinstance(entry, dict) or entry.get("role") not in ("system", "user", "assistant"):
            raise HTTPException(status_code=422, detail="INVALID_ROLE")
        content = entry.get("content")
        if not isinstance(content, str) or not content.strip() or len(content) > 2500:
            raise HTTPException(status_code=422, detail="INVALID_CONTENT")
        safe.append({"role": entry["role"], "content": content})
        user_count += int(entry["role"] == "user")
    if not user_count or safe[-1]["role"] != "user":
        raise HTTPException(status_code=422, detail="USER_MESSAGE_REQUIRED")
    tokens = payload.get("max_new_tokens", 192)
    if isinstance(tokens, bool) or not isinstance(tokens, int) or not 16 <= tokens <= 256:
        raise HTTPException(status_code=422, detail="INVALID_MAX_TOKENS")
    return model, safe, tokens

def load_adapter(model_id: str):
    with _MODEL_LOCK:
        if _ACTIVE.get("name") == model_id:
            return _ACTIVE["model"], _ACTIVE["tokenizer"], _ACTIVE["device"]
        # R2 and Lite models are loaded sequentially to avoid doubling RAM usage.
        old = _ACTIVE.pop("model", None)
        _ACTIVE.clear()
        if old is not None:
            del old
        gc.collect()
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM
        from peft import PeftModel
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        model_name, revision = BASES[model_id]
        adapter_path = model_dir(model_id)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32
        tokenizer = AutoTokenizer.from_pretrained(model_name, revision=revision, trust_remote_code=False)
        if tokenizer.pad_token_id is None:
            tokenizer.pad_token = tokenizer.eos_token
        base = AutoModelForCausalLM.from_pretrained(
            model_name, revision=revision, torch_dtype=dtype, trust_remote_code=False,
            low_cpu_mem_usage=True,
        )
        model = PeftModel.from_pretrained(base, str(adapter_path), is_trainable=False)
        model.to(device)
        model.eval()
        _ACTIVE.update({"name": model_id, "model": model, "tokenizer": tokenizer, "device": device})
        return model, tokenizer, device

def generate(model_id: str, messages: list[dict[str, str]], max_tokens: int) -> dict[str, Any]:
    with _MODEL_LOCK:
        import torch
        model, tokenizer, device = load_adapter(model_id)
        prompt_tokens = tokenizer.apply_chat_template(
            messages, tokenize=True, add_generation_prompt=True, return_tensors="pt"
        )
        if isinstance(prompt_tokens, dict):
            input_ids = prompt_tokens["input_ids"]
            attention_mask = prompt_tokens.get("attention_mask")
        else:
            input_ids = prompt_tokens
            attention_mask = None
        if input_ids.shape[1] > 2048:
            raise HTTPException(status_code=413, detail="CONTEXT_TOO_LONG")
        input_ids = input_ids.to(device)
        if attention_mask is not None:
            attention_mask = attention_mask.to(device)
        else:
            attention_mask = torch.ones_like(input_ids)
        started = time.monotonic()
        with torch.inference_mode():
            output = model.generate(
                input_ids=input_ids, attention_mask=attention_mask,
                do_sample=False, max_new_tokens=max_tokens,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id,
            )
        completion = output[0, input_ids.shape[1]:]
        text = tokenizer.decode(completion, skip_special_tokens=True).strip()
        return {"model": model_id, "text": text[:15000],
                "latency_ms": round((time.monotonic() - started) * 1000),
                "prompt_tokens": int(input_ids.shape[1]),
                "completion_tokens": int(completion.shape[0]),
                "engine": "transformers-peft-"+device}

@app.get("/healthz")
async def health():
    return {"ok": True, "service": "eduai-model-lab"}

@app.get("/models")
async def models(request: Request):
    check_token(request)
    return {"models": [
        {"id": name, "available": available(name), "loaded": _ACTIVE.get("name") == name}
        for name in BASES
    ]}

@app.post("/chat")
async def chat(request: Request):
    check_token(request)
    if int(request.headers.get("content-length") or 0) > 12000:
        raise HTTPException(status_code=413, detail="BODY_TOO_LARGE")
    data = await request.body()
    if len(data) > 12000:
        raise HTTPException(status_code=413, detail="BODY_TOO_LARGE")
    try:
        payload = json.loads(data)
    except (json.JSONDecodeError, UnicodeError):
        raise HTTPException(status_code=400, detail="INVALID_JSON")
    model, messages, max_tokens = parse_payload(payload)
    # CPU/GPU execution is offloaded, but a single model is resident at a time.
    try:
        return await asyncio.to_thread(generate, model, messages, max_tokens)
    except HTTPException:
        raise
    except Exception as error:
        # Do not expose prompts, tokens or filesystem paths to clients.
        print("INFERENCE_FAILURE", type(error).__name__, flush=True)
        raise HTTPException(status_code=503, detail="MODEL_INFERENCE_FAILURE") from None
