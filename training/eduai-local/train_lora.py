#!/usr/bin/env python3
"""Entrenamiento LoRA/QLoRA para EDUAI-Lite.

Este script NO se ejecuta en Vercel ni en notebooks escolares. Está pensado para
una GPU externa (Colab, RunPod, Hugging Face Jobs, VM con CUDA, etc.).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from datasets import load_dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-model", default="LiquidAI/LFM2.5-350M")
    parser.add_argument("--dataset", default="training/eduai-local/example-instructions.jsonl")
    parser.add_argument("--output", default="artifacts/ai/eduai-lite-lora")
    parser.add_argument("--max-length", type=int, default=2048)
    parser.add_argument("--epochs", type=float, default=2.0)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--grad-accum", type=int, default=8)
    parser.add_argument("--load-in-4bit", action="store_true")
    return parser.parse_args()


def to_text(example: dict, tokenizer) -> str:
    messages = example.get("messages")
    if isinstance(messages, list) and messages:
        try:
            return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
        except Exception:
            return "\n".join(f"{m.get('role', 'user')}: {m.get('content', '')}" for m in messages)

    instruction = str(example.get("instruction", "")).strip()
    input_text = str(example.get("input", "")).strip()
    output = str(example.get("output", "")).strip()
    body = instruction
    if input_text:
        body += "\n\nContexto:\n" + input_text
    return f"Usuario: {body}\nAsistente: {output}"


def main() -> None:
    args = parse_args()
    dataset_path = Path(args.dataset)
    if not dataset_path.exists():
        raise SystemExit(f"Dataset no encontrado: {dataset_path}")

    tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token

    quantization_config = None
    model_kwargs = {"trust_remote_code": True}
    if args.load_in_4bit:
        if not torch.cuda.is_available():
            raise SystemExit("--load-in-4bit requiere CUDA.")
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
        )
        model_kwargs["quantization_config"] = quantization_config
        model_kwargs["device_map"] = "auto"
    else:
        model_kwargs["torch_dtype"] = (
            torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported()
            else torch.float16 if torch.cuda.is_available()
            else torch.float32
        )
        if torch.cuda.is_available():
            model_kwargs["device_map"] = "auto"

    model = AutoModelForCausalLM.from_pretrained(args.base_model, **model_kwargs)
    if quantization_config is not None:
        model = prepare_model_for_kbit_training(model)

    lora = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules="all-linear",
    )
    model = get_peft_model(model, lora)

    raw = load_dataset("json", data_files=str(dataset_path), split="train")
    formatted = raw.map(lambda row: {"text": to_text(row, tokenizer)})

    def tokenize(batch):
        return tokenizer(
            batch["text"],
            truncation=True,
            max_length=args.max_length,
            padding=False,
        )

    tokenized = formatted.map(tokenize, batched=True, remove_columns=formatted.column_names)

    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)

    train_args = TrainingArguments(
        output_dir=str(output),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.learning_rate,
        warmup_ratio=0.05,
        lr_scheduler_type="cosine",
        logging_steps=10,
        save_strategy="epoch",
        report_to=[],
        bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
        fp16=torch.cuda.is_available() and not torch.cuda.is_bf16_supported(),
        gradient_checkpointing=True,
        remove_unused_columns=False,
    )

    trainer = Trainer(
        model=model,
        args=train_args,
        train_dataset=tokenized,
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
    )
    trainer.train()
    trainer.save_model(str(output))
    tokenizer.save_pretrained(str(output))

    manifest = {
        "baseModel": args.base_model,
        "dataset": str(dataset_path),
        "output": str(output),
        "method": "QLoRA" if args.load_in_4bit else "LoRA",
        "examples": len(raw),
        "maxLength": args.max_length,
    }
    (output / "eduai-training-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
