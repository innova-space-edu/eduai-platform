"""Unit tests for EDUAI Dataset Factory: no GPU, network, or personal data."""
from __future__ import annotations
import copy
from pathlib import Path
import tempfile
import unittest

from build_dataset import (
    DEFAULT_SEED, DEFAULT_HOLDOUT, DatasetError, read_jsonl,
    assign_groups, build, normalize_prompt, validate, write_splits,
)


class DatasetFactoryTests(unittest.TestCase):
    def setUp(self):
        self.seed = read_jsonl(DEFAULT_SEED)
        self.holdout = read_jsonl(DEFAULT_HOLDOUT)

    def test_seed_is_synthetic_and_pending_review(self):
        groups, stats = validate(self.seed, self.holdout)
        self.assertEqual(stats["examples"], 54)
        self.assertEqual(stats["families"], 18)
        self.assertEqual(stats["pending_human_review"], 54)
        self.assertEqual(len(groups), 18)

    def test_splits_disjoint_by_family_and_id(self):
        splits, manifest = build(DEFAULT_SEED, DEFAULT_HOLDOUT, "eduai-dataset-v1")
        ids, families = set(), set()
        for name, rows in splits.items():
            next_ids = set(manifest["splits"][name]["ids"])
            next_groups = set(manifest["splits"][name]["families"])
            self.assertFalse(next_ids & ids)
            self.assertFalse(next_groups & families)
            self.assertGreater(len(rows), 0)
            ids |= next_ids
            families |= next_groups
        self.assertEqual(len(ids), 54)
        self.assertFalse(manifest["training_ready"])
        self.assertFalse(manifest["production_ready"])

    def test_seed_assignment_is_stable_under_row_reorder(self):
        groups_a, _ = validate(self.seed, self.holdout)
        groups_b, _ = validate(list(reversed(self.seed)), self.holdout)
        self.assertEqual(assign_groups(groups_a, "fixed"), assign_groups(groups_b, "fixed"))

    def test_duplicate_prompt_rejected(self):
        data = copy.deepcopy(self.seed)
        data[1]["messages"][1]["content"] = data[0]["messages"][1]["content"]
        with self.assertRaisesRegex(DatasetError, "duplicado"):
            validate(data, self.holdout)

    def test_duplicate_identifier_rejected(self):
        data = copy.deepcopy(self.seed)
        data[1]["id"] = data[0]["id"]
        with self.assertRaisesRegex(DatasetError, "id duplicado"):
            validate(data, self.holdout)

    def test_token_pattern_rejected(self):
        data = copy.deepcopy(self.seed)
        data[0]["messages"][1]["content"] += " KGAT_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"
        with self.assertRaisesRegex(DatasetError, "secreto"):
            validate(data, self.holdout)

    def test_email_rejected(self):
        data = copy.deepcopy(self.seed)
        data[0]["messages"][1]["content"] += " persona@ejemplo.invalid"
        with self.assertRaisesRegex(DatasetError, "dato personal"):
            validate(data, self.holdout)

    def test_rut_rejected(self):
        data = copy.deepcopy(self.seed)
        data[0]["messages"][1]["content"] += " 12345678-5"
        with self.assertRaisesRegex(DatasetError, "dato personal"):
            validate(data, self.holdout)

    def test_non_synthetic_source_rejected(self):
        data = copy.deepcopy(self.seed)
        data[0]["source"] = "student-conversation"
        with self.assertRaisesRegex(DatasetError, "sintéticos"):
            validate(data, self.holdout)

    def test_existing_holdout_is_reserved(self):
        data = copy.deepcopy(self.seed)
        data[0]["messages"][1]["content"] = self.holdout[0]["prompt"]
        with self.assertRaisesRegex(DatasetError, "contaminación"):
            validate(data, self.holdout)

    def test_trainer_jsonl_compatible_and_hashed(self):
        splits, manifest = build(DEFAULT_SEED, DEFAULT_HOLDOUT, "eduai-dataset-v1")
        with tempfile.TemporaryDirectory() as tmp:
            write_splits(splits, manifest, Path(tmp))
            for name in splits:
                rows = read_jsonl(Path(tmp) / f"{name}.jsonl")
                self.assertEqual(set(rows[0].keys()), {"messages"})
                self.assertEqual(len(manifest["splits"][name]["sha256"]), 64)
            self.assertTrue((Path(tmp) / "manifest.json").is_file())

    def test_prompt_normalization(self):
        self.assertEqual(normalize_prompt("  Área  DEL    círculo "), "area del circulo")


if __name__ == "__main__":
    unittest.main()
