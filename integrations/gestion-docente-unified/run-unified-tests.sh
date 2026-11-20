#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
node --test ./*.test.mjs ../gestion-docente-worker/worker.test.mjs
python3 -B -m unittest -v test_inspect_ooxml test_hub_metadata_sqlite
