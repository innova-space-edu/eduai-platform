#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Uso: $0 <merged_model_dir> <output.gguf> [quant]"
  exit 2
fi

MERGED_DIR="$1"
OUTPUT_GGUF="$2"
QUANT="$3"
if [[ -z "$QUANT" ]]; then
  QUANT="Q4_K_M"
fi

LLAMA_CPP_DIR="${LLAMA_CPP_DIR:-}"\nif [[ -z "$LLAMA_CPP_DIR" ]]; then
  echo "Falta LLAMA_CPP_DIR apuntando a un checkout de llama.cpp." >&2
  exit 2
fi

CONVERTER="$LLAMA_CPP_DIR/convert_hf_to_gguf.py"
if [[ ! -f "$CONVERTER" ]]; then
  echo "No se encontró $CONVERTER" >&2
  exit 2
fi

QUANTIZER=""
for candidate in "$LLAMA_CPP_DIR/build/bin/llama-quantize" "$LLAMA_CPP_DIR/llama-quantize"; do
  if [[ -x "$candidate" ]]; then
    QUANTIZER="$candidate"
    break
  fi
done

if [[ -z "$QUANTIZER" ]]; then
  echo "No se encontró llama-quantize. Compila llama.cpp antes de exportar." >&2
  exit 2
fi

mkdir -p "$(dirname "$OUTPUT_GGUF")"
TEMP_F16="${OUTPUT_GGUF%.gguf}.f16.gguf"

python "$CONVERTER" "$MERGED_DIR" --outfile "$TEMP_F16" --outtype f16
"$QUANTIZER" "$TEMP_F16" "$OUTPUT_GGUF" "$QUANT"
python training/eduai-local/gguf_manifest.py --artifact "$OUTPUT_GGUF" --quant "$QUANT"

echo "GGUF listo: $OUTPUT_GGUF"
