"""EDUAI offline GGUF cache and native Bonsai safety tests."""
from __future__ import annotations
import hashlib
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

from artifact_store import ArtifactStore, CacheError, hash_file
from native_bonsai_probe import check_binary, preflight, run_cpu_smoke

class OfflineStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.store = ArtifactStore(self.root / "cache")
        self.source = self.root / "Bonsai2-PTQ1_0.gguf"
        self.source.write_bytes(b"GGUF" + b"source-test-only" * 8)
        self.digest = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.binary = self.root / "llama-cli"
        self.binary.write_bytes(b"mock binary; never executed in tests")
        self.binary.chmod(0o700)
        self.binary_digest = hashlib.sha256(self.binary.read_bytes()).hexdigest()

    def add(self, pin=False):
        return self.store.add(
            self.source, "bonsai2-2b", self.digest,
            pin=pin, quantization="PTQ1_0",
        )

    def test_import_and_integrity(self):
        entry = self.add()
        self.assertFalse(entry["reused"])
        self.assertTrue(self.store.verify(self.digest)["verified"])
        self.assertTrue(Path(entry["path"]).is_file())
        self.assertEqual(entry["quantization"], "PTQ1_0")

    def test_reuse_without_duplicate_weights(self):
        self.add()
        entry = self.add()
        self.assertTrue(entry["reused"])
        self.assertEqual(len(list((self.store.root / "sha256").glob("*.gguf"))), 1)

    def test_wrong_hash_cannot_be_imported(self):
        with self.assertRaisesRegex(CacheError, "SHA-256 incorrecto"):
            self.store.add(self.source, "bonsai2-2b", "0" * 64, quantization="PTQ1_0")
        self.assertFalse(list((self.store.root / "sha256").glob("*.gguf")))

    def test_rejects_fake_gguf(self):
        self.source.write_bytes(b"TEXT" + b"not a gguf")
        digest = hashlib.sha256(self.source.read_bytes()).hexdigest()
        with self.assertRaisesRegex(CacheError, "Cabecera GGUF inválida"):
            self.store.add(self.source, "bonsai2-2b", digest, quantization="PTQ1_0")

    def test_detects_corruption(self):
        entry = self.add()
        Path(entry["path"]).write_bytes(b"GGUFcorrupted")
        with self.assertRaisesRegex(CacheError, "no coincide"):
            self.store.verify(self.digest)

    def test_never_prunes_without_explicit_apply(self):
        self.add()
        report = self.store.prune(0)
        self.assertTrue(report["dry_run"])
        self.assertEqual(report["planned_sha256"], [self.digest])
        self.assertEqual(len(self.store.list()), 1)

    def test_pinned_model_survives_prune(self):
        self.add(pin=True)
        result = self.store.prune(0, apply=True)
        self.assertEqual(result["planned_sha256"], [])
        self.assertFalse(result["target_reachable"])
        self.assertTrue(self.store.verify(self.digest)["verified"])

    def test_unpin_then_explicit_prune(self):
        self.add(pin=True)
        self.store.pin(self.digest, False)
        result = self.store.prune(0, apply=True)
        self.assertFalse(result["dry_run"])
        self.assertEqual(len(self.store.list()), 0)

    def test_no_delete_after_tampering(self):
        entry = self.add()
        Path(entry["path"]).write_bytes(b"bad")
        with self.assertRaises(CacheError):
            self.store.prune(0, apply=True)
        self.assertEqual(len(self.store.list()), 1)

    def test_rejects_symlink_sources_and_cache(self):
        link = self.root / "link.gguf"
        link.symlink_to(self.source)
        with self.assertRaises(CacheError):
            self.store.add(link, "bonsai2-2b", self.digest, quantization="PTQ1_0")
        redirect = self.root / "redirect"
        redirect.symlink_to(self.root)
        with self.assertRaises(CacheError):
            ArtifactStore(redirect)

    def test_rejects_symlink_model_folder(self):
        self.store.root.mkdir(parents=True)
        (self.store.root / "sha256").symlink_to(self.root)
        with self.assertRaises(CacheError):
            self.add()

    def test_existing_lock_prevents_concurrent_write(self):
        self.store.root.mkdir(parents=True)
        (self.store.root / ".index.lock").write_text("locked")
        with self.assertRaisesRegex(CacheError, "bloqueado"):
            self.add()

    def test_rejects_bonsai_without_declared_quantization(self):
        with self.assertRaisesRegex(CacheError, "requiere declarar"):
            self.store.add(self.source, "bonsai2-2b", self.digest)

    def test_different_quantization_same_digest_rejected(self):
        self.add()
        new = self.root / "Bonsai2-PQ2_0.gguf"
        new.write_bytes(self.source.read_bytes())
        with self.assertRaisesRegex(CacheError, "inconsistente"):
            self.store.add(new, "bonsai2-2b", self.digest, quantization="PQ2_0")

    def test_no_name_traversal(self):
        with self.assertRaises(CacheError):
            self.store.add(self.source, "../escape", self.digest, quantization="PTQ1_0")

    def test_native_preflight_requires_matching_binary_hash(self):
        self.add()
        with self.assertRaisesRegex(CacheError, "ejecutable no coincide"):
            preflight(self.store, "bonsai2-2b", self.digest, self.binary, "0" * 64, "prism-b10777-e3de715")

    def test_native_preflight_reports_but_does_not_launch(self):
        self.add()
        with patch("native_bonsai_probe.subprocess.run") as run:
            result = preflight(self.store, "bonsai2-2b", self.digest,
                               self.binary, self.binary_digest, "prism-b10777-e3de715")
            self.assertFalse(result["execution_authorized"])
            run.assert_not_called()

    def test_native_rejects_non_bonsai_model(self):
        self.add()
        with self.assertRaisesRegex(CacheError, "Solo se permiten"):
            preflight(self.store, "random", self.digest,
                      self.binary, self.binary_digest, "prism-b10777-e3de715")

    def test_native_cpu_smoke_requires_explicit_limits(self):
        self.add()
        plan = preflight(self.store, "bonsai2-2b", self.digest,
                         self.binary, self.binary_digest, "prism-b10777-e3de715")
        with self.assertRaisesRegex(CacheError, "límites"):
            run_cpu_smoke(plan, 30000, 32, 120)

    def test_cpu_smoke_arguments_safe(self):
        self.add()
        plan = preflight(self.store, "bonsai2-2b", self.digest,
                         self.binary, self.binary_digest, "prism-b10777-e3de715")
        with patch("native_bonsai_probe.subprocess.run") as run:
            run.return_value.returncode = 0
            run.return_value.stdout = "Azul"
            run.return_value.stderr = "elapsed"
            result = run_cpu_smoke(plan, 512, 32, 120)
            args, kwargs = run.call_args
            self.assertEqual(args[0][0], str(self.binary.resolve()))
            self.assertEqual(args[0][args[0].index("-ngl") + 1], "0")
            self.assertIs(kwargs["shell"], False)
            self.assertFalse(result["production_ready"])


if __name__ == "__main__":
    unittest.main()
