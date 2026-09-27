#!/usr/bin/env python3
"""Fusiona un adaptador LoRA/QLoRA de EDUAI con su modelo base."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from peft import PeftConfig, PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--adapter", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--base-model", default="")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    adapter = Path(args.adapter)
    if not adapter.exists():
        raise SystemExit(f"Adaptador no encontrado: {adapter}")

    config = PeftConfig.from_pretrained(str(adapter))
    base_model = args.base_model.strip() or config.base_model_name_or_path
    if not base_model:
        raise SystemExit("No fue posible determinar el modelo base.")

    dtype = (
        torch.bfloat16
        if torch.cuda.is_available() and torch.cuda.is_bf16_supported()
        else torch.float16
        if torch.cuda.is_available()
        else torch.float32
    )

    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=dtype,
        device_map="auto" if torch.cuda.is_available() else None,
        trust_remote_code=True,
        low_cpu_mem_usage=True,
    )
    model = PeftModel.from_pretrained(model, str(adapter))
    merged = model.merge_and_unload()

    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    merged.save_pretrained(str(output), safe_serialization=True)

    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    tokenizer.save_pretrained(str(output))

    manifest = {
        "adapter": str(adapter),
        "baseModel": base_model,
        "output": str(output),
        "dtype": str(dtype),
        "stage": "merged-transformers",
    }
    (output / "eduai-merge-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
