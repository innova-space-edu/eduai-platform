#!/usr/bin/env python3
"""Check REAL R2 PEFT inference service; only uses standard Python library."""
from __future__ import annotations
import argparse
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request

def call(base: str, token: str, path: str, payload: dict | None = None, timeout: int = 15) -> dict:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        base.rstrip("/") + path,
        data=body,
        method="GET" if body is None else "POST",
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        value = json.load(response)
    if not isinstance(value, dict):
        raise RuntimeError("Respuesta JSON inválida")
    return value

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8122")
    parser.add_argument("--smoke", action="store_true",
                        help="Generar una respuesta real con cada adaptador R2")
    args = parser.parse_args()
    items = {}
    for row in pathlib.Path(args.env_file).read_text().splitlines():
        if "=" in row and not row.lstrip().startswith("#"):
            k,v = row.split("=",1)
            items[k]=v
    token=items.get("EDUAI_MODEL_LAB_TOKEN","")
    if len(token)<40:
        raise SystemExit("Token privado ausente o insuficiente")
    models=call(args.base_url,token,"/models")
    status={m["id"]:m for m in models.get("models",[]) if isinstance(m,dict)}
    for name in ("nano-r2","lite-r2"):
        if not status.get(name,{}).get("available"):
            raise SystemExit(f"Adaptador R2 no disponible: {name}")
        print(f"[OK] {name} instalado",flush=True)
    if args.smoke:
        for name in ("nano-r2","lite-r2"):
            started=time.monotonic()
            result=call(args.base_url,token,"/chat",{
                "model":name,
                "messages":[{"role":"user","content":"Responde únicamente: hola"}],
                "max_new_tokens":24,
            },timeout=300)
            if result.get("model")!=name or not str(result.get("text","")).strip():
                raise SystemExit(f"ERROR: {name} devolvió una respuesta vacía o de otro adaptador")
            print(f"[OK] {name}: inferencia real completada, "
                  f"tokens={result.get('completion_tokens')}, "
                  f"duración={round(time.monotonic()-started,1)} s",flush=True)
    print("[LISTO] Motor local verificado; falta verificar HTTPS en Vercel.",flush=True)

if __name__=="__main__":
    try:
        main()
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"Error HTTP {exc.code}: comprueba Docker y token")
    except (urllib.error.URLError,TimeoutError) as exc:
        raise SystemExit(f"Sin respuesta del Dell: {type(exc).__name__}")
