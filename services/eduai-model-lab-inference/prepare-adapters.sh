#!/usr/bin/env bash
# Prepare read-only R2 adapters from the owner's private Kaggle dataset.
# Usage: bash prepare-adapters.sh /path/to/extracted/eduai-nano-lite-adapters-r2
set -euo pipefail
src="${1:?Pass the extracted private R2 dataset directory}"
dst="${EDUAI_MODEL_LAB_MODELS_DIR:-/srv/eduai-model-lab/models}"
test -f "$src/nano_adapter_model.safetensors"
test -f "$src/nano_adapter_config.json"
test -f "$src/lite_adapter_model.safetensors"
test -f "$src/lite_adapter_config.json"
mkdir -p "$dst/nano-r2" "$dst/lite-r2"
for name in nano lite; do
  install -m 0644 "$src/${name}_adapter_model.safetensors" "$dst/${name}-r2/adapter_model.safetensors"
  install -m 0644 "$src/${name}_adapter_config.json" "$dst/${name}-r2/adapter_config.json"
done
echo "R2 adapter files prepared. No R5 or model promotion occurred."
ls -lh "$dst"/nano-r2/adapter_model.safetensors "$dst"/lite-r2/adapter_model.safetensors
