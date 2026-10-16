"""Offline bridge tests: no token or Kaggle access required."""
import importlib.util
import json
import os
from pathlib import Path
from unittest.mock import patch
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "client.py"
spec = importlib.util.spec_from_file_location("kaggle_client", SOURCE)
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)


class BridgeTests(unittest.TestCase):
    def test_valid_reference(self):
        self.assertEqual(client.reference("esthefano", "eduai-factory"), "esthefano/eduai-factory")

    def test_rejects_path_traversal(self):
        with self.assertRaises(client.KaggleBridgeError):
            client.reference("../other", "run")
        with self.assertRaises(client.KaggleBridgeError):
            client.reference("esthefano", "other; echo injected")

    def test_rejects_page_above_limit(self):
        with self.assertRaises(client.KaggleBridgeError):
            client.my_notebooks(500)

    def test_csv_parsing(self):
        with patch.object(client, "_run", return_value="ref,title\na/notebook,First notebook\n"):
            self.assertEqual(client.my_notebooks()["notebooks"][0]["ref"], "a/notebook")

    def test_redaction(self):
        with patch.dict(os.environ, {"KAGGLE_API_TOKEN": "EXAMPLE-ONLY-NEVER-REAL"}):
            self.assertEqual(client._redact("token=EXAMPLE-ONLY-NEVER-REAL"), "token=[REDACTED]")

    def test_write_disabled_by_default(self):
        with patch.dict(os.environ, {"KAGGLE_ENABLE_WRITES": "false"}):
            with self.assertRaisesRegex(client.KaggleBridgeError, "deshabilitadas"):
                client.submit_eduai_smoke("esthefano", "eduai", confirmed=True, run_gpu=False)

    def test_wrong_owner_blocked(self):
        with patch.dict(os.environ, {"KAGGLE_ENABLE_WRITES": "true", "KAGGLE_ALLOWED_OWNER": "esthefano"}):
            with self.assertRaisesRegex(client.KaggleBridgeError, "cuenta autorizada"):
                client.submit_eduai_smoke("otro", "eduai", confirmed=True, run_gpu=False)

    def test_requires_approval(self):
        with patch.dict(os.environ, {"KAGGLE_ENABLE_WRITES": "true", "KAGGLE_ALLOWED_OWNER": "esthefano"}):
            with self.assertRaisesRegex(client.KaggleBridgeError, "aprobar"):
                client.submit_eduai_smoke("esthefano", "eduai", confirmed=False, run_gpu=False)

    def test_gpu_runs_need_separate_permission(self):
        with patch.dict(os.environ, {
            "KAGGLE_ENABLE_WRITES": "true",
            "KAGGLE_ALLOWED_OWNER": "esthefano",
            "KAGGLE_GPU_RUNS_ENABLED": "false"
        }):
            with self.assertRaisesRegex(client.KaggleBridgeError, "GPU"):
                client.submit_eduai_smoke("esthefano", "eduai", confirmed=True, run_gpu=True)

    def test_private_metadata_and_no_run(self):
        with tempfile.TemporaryDirectory() as temp:
            notebook = Path(temp) / "example.ipynb"
            notebook.write_text('{"nbformat":4}', encoding="utf8")
            with (
                patch.object(client, "SAMPLE_NOTEBOOK", notebook),
                patch.object(client, "_run") as runner,
                patch.dict(os.environ, {"KAGGLE_ENABLE_WRITES": "true", "KAGGLE_ALLOWED_OWNER": "esthefano"}),
            ):
                def validate(args, timeout):
                    metadata = json.loads((Path(args[2]) / "kernel-metadata.json").read_text())
                    self.assertTrue(metadata["is_private"])
                    self.assertFalse(metadata["enable_gpu"])
                    self.assertIn("--no-run", args)
                    return "published"
                runner.side_effect = validate
                result = client.submit_eduai_smoke("esthefano", "eduai", confirmed=True, run_gpu=False)
                self.assertTrue(result["submitted"])


if __name__ == "__main__":
    unittest.main()
