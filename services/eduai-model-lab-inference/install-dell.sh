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
# Allow the non-root Kaggle CLI to traverse only the parent, not list its secrets.
sudo chmod 0711 "$DEST"
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
  # Reutilizar el Kaggle API del puente ya autenticado. El lanzador local
  # kaggle-v225.sh exige otra versión y puede desaparecer tras reinicios;
  # no reinstalamos CLI en el servidor ni tocamos notebooks.
  if sudo docker container inspect portal-kaggle-bridge-1 >/dev/null 2>&1; then
    echo "[INFO] Descargando mediante portal-kaggle-bridge-1 (Kaggle existente)."
    sudo docker exec -i portal-kaggle-bridge-1 sh -s <<'BRIDGE'
set -eu
target=/data/eduai-model-lab-r2
mkdir -p "$target"
dataset=esthefano/eduai-nano-lite-adapters-r2
downloaded=no

if command -v kaggle >/dev/null 2>&1; then
  if kaggle datasets download -d "$dataset" -p "$target" --unzip; then
    downloaded=yes
  fi
fi

if [ "$downloaded" != yes ]; then
  # API del paquete instalado: el mismo acceso que usa el conector del Dell.
  for python in python3 python /opt/venv/bin/python /data/venv/bin/python /tmp/eduai-kaggle-cli-v225/bin/python; do
    if command -v "$python" >/dev/null 2>&1 && "$python" -c 'from kaggle.api.kaggle_api_extended import KaggleApi' >/dev/null 2>&1; then
      if "$python" - "$target" "$dataset" <<'PY'
import sys
from kaggle.api.kaggle_api_extended import KaggleApi
api=KaggleApi()
api.authenticate()
api.dataset_download_files(sys.argv[2],path=sys.argv[1],unzip=True,quiet=False)
PY
      then
        downloaded=yes
        break
      fi
    fi
  done
fi

if [ "$downloaded" != yes ]; then
  echo "No se encontró Kaggle API/CLI utilizable dentro del puente." >&2
  exit 8
fi
for file in nano_adapter_model.safetensors nano_adapter_config.json \
            lite_adapter_model.safetensors lite_adapter_config.json; do
  test -s "$target/$file" || { echo "Falta $file en el dataset R2." >&2; exit 9; }
done
echo "[OK] Cuatro archivos esenciales de R2 descargados."
BRIDGE
    sudo docker cp portal-kaggle-bridge-1:/data/eduai-model-lab-r2/. "$DEST/incoming/"
  elif command -v kaggle >/dev/null 2>&1; then
    kaggle datasets download -d "$DATASET" -p "$DEST/incoming" --unzip
  else
    echo "El puente Kaggle no está disponible. Deja los cuatro archivos R2 en:" >&2
    echo "  $DEST/incoming/" >&2
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
