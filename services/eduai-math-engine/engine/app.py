"""Secured HTTP entrypoint for typed SymPy operations."""
import json
import os
import secrets
from fastapi import FastAPI, Request, HTTPException
from .solver import solve
app=FastAPI(title="EDUAI Math",docs_url=None,redoc_url=None,openapi_url=None)
@app.get("/healthz")
def health():return {"ok":True}
@app.post("/solve")
async def calculate(request:Request):
    key=os.getenv("EDUAI_MATH_ENGINE_TOKEN")
    if not key or not secrets.compare_digest(request.headers.get("authorization",""),"Bearer "+key):
        raise HTTPException(status_code=401,detail="UNAUTHORIZED")
    body=await request.body()
    if len(body)>4096:raise HTTPException(status_code=413,detail="PAYLOAD_TOO_LARGE")
    try:return solve(json.loads(body))
    except (ValueError,TypeError,KeyError,ZeroDivisionError) as exc:
        raise HTTPException(status_code=422,detail=str(exc)) from exc
