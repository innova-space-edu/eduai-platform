#!/usr/bin/env bash
# One-time Dell bootstrap for the REAL EDUAI Nano R2 / Lite R2 inference service.
# Does not create Kaggle notebooks, change R5, or expose the model service publicly.
set -euo pipefail
umask 077

if [ "${EUID}" -eq 0 ]; then
  echo "Ejecuta este script como usuario normal con permiso sudo, no como root." >&2
  exit 2
fi
for cmd in sudo docker curl python3; do
  command -v "$cmd" >/dev/null || { echo "Falta $cmd" >&2; exit 2; }
done
DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEST="/srv/eduai-model-lab"
DATASET="esthefano/eduai-nano-lite-adapters-r2"
TOKENFILE="$DEST/.env"
mkdir -p "$DIR"
sudo install -d -m 0750 "$DEST" "$DEST/models" "$DEST/incoming" "$DEST/cache"
sudo chown -R "$(id -u):$(id -g)" "$DEST/incoming"

if ! sudo test -f "$TOKENFILE"; then
  token="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
  printf 'EDUAI_MODEL_LAB_TOKEN=%s\n' "$token" | sudo tee "$TOKENFILE" >/dev/null
  unset token
  sudo chmod 0600 "$TOKENFILE"
  echo "[OK] Token privado generado en $TOKENFILE (sin imprimirlo)."
else
  echo "[OK] Se reutiliza el token privado existente."
fi
if ! sudo grep -q '^EDUAI_MODEL_LAB_TOKEN=.' "$TOKENFILE"; then
  echo "El archivo .env no contiene un token válido." >&2
  exit 3
fi

if [ ! -s "$DEST/incoming/nano_adapter_model.safetensors" ] ||
   [ ! -s "$DEST/incoming/lite_adapter_model.safetensors" ] ||
   [ ! -s "$DEST/incoming/nano_adapter_config.json" ] ||
   [ ! -s "$DEST/incoming/lite_adapter_config.json" ]; then
  echo "[INFO] Descargando SOLO dataset privado R2 de Kaggle."
  wrapper="$HOME/eduai-advanced-v2/kaggle-v225.sh"
  if [ -x "$wrapper" ] && sudo docker container inspect portal-kaggle-bridge-1 >/dev/null 2>&1; then
    sudo docker exec portal-kaggle-bridge-1 mkdir -p /data/eduai-model-lab-r2
    "$wrapper" datasets download -d "$DATASET" -p /data/eduai-model-lab-r2 --unzip
    sudo docker cp portal-kaggle-bridge-1:/data/eduai-model-lab-r2/. "$DEST/incoming/"
  elif command -v kaggle >/dev/null; then
    kaggle datasets download -d "$DATASET" -p "$DEST/incoming" --unzip
  else
    echo "No encuentro Kaggle CLI. Copia los 4 archivos R2 al directorio:" >&2
    echo "  $DEST/incoming/" >&2
    echo "y vuelve a ejecutar este instalador. No utilices adaptadores R4/R5." >&2
    exit 4
  fi
fi

sudo python3 - "$DEST/incoming" <<'PY'
import json, pathlib, sys
root=pathlib.Path(sys.argv[1])
models={"nano":"LiquidAI/LFM2.5-350M","lite":"LiquidAI/LFM2.5-1.2B-Instruct"}
for key, base in models.items():
    config=root/f"{key}_adapter_config.json"
    weight=root/f"{key}_adapter_model.safetensors"
    if not config.is_file() or not weight.is_file() or weight.stat().st_size<100000:
        raise SystemExit(f"R2 incompleto: {key}")
    data=json.loads(config.read_text())
    ref=data.get("base_model_name_or_path")
    if ref and ref.rstrip("/") != base:
        raise SystemExit(f"Modelo base inesperado para {key}: {ref}")
    if data.get("peft_type")!="LORA":
        raise SystemExit(f"PEFT no reconocido en {key}")
    print(f"[OK] {key} R2: adaptador {weight.stat().st_size:,} bytes, base {base}")
PY

sudo bash "$DIR/prepare-adapters.sh" "$DEST/incoming"
# Read-only group access for the non-root container user (gid 10001).
sudo chown -R root:10001 "$DEST/models"
sudo chmod 0750 "$DEST/models" "$DEST/models/nano-r2" "$DEST/models/lite-r2"
sudo chmod 0640 "$DEST/models/nano-r2/"* "$DEST/models/lite-r2/"*
sudo chown -R 10001:10001 "$DEST/cache"
sudo chmod 0750 "$DEST/cache"
# Existing Cloudflare Tunnel runs on the portal_default bridge on this Dell.
sudo docker network inspect portal_default >/dev/null ||
  { echo "No existe la red portal_default para el túnel Cloudflare." >&2; exit 5; }
echo "[INFO] Construyendo e iniciando contenedor privado (solo localhost:8122)."
sudo docker compose --env-file "$TOKENFILE" -f "$DIR/compose.example.yml" up -d --build
for i in $(seq 1 40); do
  if curl -fsS --max-time 3 http://127.0.0.1:8122/healthz >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
sudo python3 "$DIR/verify-local.py" --env-file "$TOKENFILE" --base-url http://127.0.0.1:8122
curl -fsS --max-time 5 http://127.0.0.1:8122/healthz >/dev/null ||
 { echo "Servicio no saludable. Revisa: sudo docker logs eduai-model-lab-inference" >&2; exit 5; }

# Do not leak the actual token to stdout.
sudo python3 - "$TOKENFILE" <<'PY'
from pathlib import Path
import sys
token=Path(sys.argv[1]).read_text().strip().partition("=")[2]
print("[OK] Token configurado; longitud:",len(token),"(el valor permanece privado)")
PY
echo "[OK] Servicio respondiendo en http://127.0.0.1:8122/healthz"
echo "[PENDIENTE] Para que Vercel funcione, conecta Cloudflare Tunnel HTTPS al puerto 8122"
echo "            y registra las variables privadas del proyecto Vercel."
echo "            Nunca pegues el token en un chat."
