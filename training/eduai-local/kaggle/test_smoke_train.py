"""Pruebas rápidas de preflight que no consumen GPU."""
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("eduai_kaggle_smoke", HERE / "smoke_train.py")
runner = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(runner)


class DatasetSmokeTests(unittest.TestCase):
    def test_repo_example_has_chat_messages(self):
        count, checksum = runner.validate_dataset(runner.DEFAULT_DATA)
        self.assertGreaterEqual(count, 1)
        self.assertEqual(len(checksum), 64)

    def test_rejects_empty_jsonl(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "empty.jsonl"
            path.write_text("", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "vacío"):
                runner.validate_dataset(path)

    def test_rejects_unfinished_conversation(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "wrong.jsonl"
            row = {"messages": [{"role": "user", "content": "hola"}]}
            path.write_text(json.dumps(row) + "\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "assistant"):
                runner.validate_dataset(path)

    def test_rejects_bad_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bad.jsonl"
            path.write_text("{not-json}\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "JSONL inválido"):
                runner.validate_dataset(path)


if __name__ == "__main__":
    unittest.main()
