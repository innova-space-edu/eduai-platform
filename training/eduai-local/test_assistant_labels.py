#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
from pathlib import Path

MODULE = Path("training/eduai-local/assistant_labels.py")
spec = importlib.util.spec_from_file_location("assistant_labels", MODULE)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


class MaskTokenizer:
    def apply_chat_template(self, messages, **kwargs):
        if kwargs.get("return_assistant_tokens_mask"):
            return {
                "input_ids": [1, 2, 3, 4, 5],
                "assistant_masks": [0, 0, 0, 1, 1],
            }
        return [1, 2, 3, 4, 5]


labels = module.build_assistant_only_labels(
    MaskTokenizer(),
    [{"role": "user", "content": "hola"}, {"role": "assistant", "content": "respuesta"}],
    [1, 2, 3, 4, 5],
)
assert labels == [-100, -100, -100, 4, 5], labels


class PrefixTokenizer:
    def apply_chat_template(self, messages, **kwargs):
        if kwargs.get("return_assistant_tokens_mask"):
            raise TypeError("mask unsupported")
        if not messages:
            return [10]
        if len(messages) == 1 and messages[0]["role"] == "user":
            return [10, 20, 30] if kwargs.get("add_generation_prompt") else [10, 20]
        return [10, 20, 30, 40, 50]


labels = module.build_assistant_only_labels(
    PrefixTokenizer(),
    [{"role": "user", "content": "hola"}, {"role": "assistant", "content": "respuesta"}],
    [10, 20, 30, 40, 50],
)
assert labels == [-100, -100, -100, 40, 50], labels

print("EDUAI assistant-only labels: OK")
