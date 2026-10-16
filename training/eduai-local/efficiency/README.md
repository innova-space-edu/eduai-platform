# EDUAI Efficiency Adapter V2 — almacenamiento SSD y preflight Bonsai

Experimental, local, biblioteca estándar Python 3.11+. Puede ejecutarse desde PC personal sin Innova Server ni Kaggle. No descarga, no sincroniza nube, no abre puertos y no modifica modelos de producción.

## Arquitectura

SSD: archivos GGUF bajo dirección SHA-256; importación verificada, sin duplicar, indexación y escritura atómica. RAM/VRAM: permanecen a cargo del motor de inferencia. SSD y mmap no sustituyen RAM de activaciones o KV cache. Nube: almacenamiento frío reservado para una fase posterior, sin implementación actual.

## Importación segura

Obtén el SHA-256 esperado desde una referencia confiable e independiente. Calcularlo sobre el archivo descargado solo detecta cambios posteriores: no certifica su procedencia. Selecciona la unidad SSD con cache-dir.

Desde la raíz del repositorio:

    python training/eduai-local/efficiency/artifact_store.py --cache-dir /ruta/ssd/eduai-cache import --path /ruta/Ternary-Bonsai-2-4B-PTQ1_0.gguf --model-id bonsai2-4b --quantization PTQ1_0 --expected-sha256 SHA_MODELO

El importador rechaza cabeceras no GGUF, digest incorrecto, enlaces simbólicos, nombres inválidos y espacio insuficiente. Los datos del formato provienen del operador; la coincidencia de nombre no certifica el formato real.

    python training/eduai-local/efficiency/artifact_store.py --cache-dir /ruta/ssd/eduai-cache list
    python training/eduai-local/efficiency/artifact_store.py --cache-dir /ruta/ssd/eduai-cache verify --sha256 SHA_MODELO
    python training/eduai-local/efficiency/artifact_store.py --cache-dir /ruta/ssd/eduai-cache pin --sha256 SHA_MODELO

La limpieza nunca borra sin --apply:

    python training/eduai-local/efficiency/artifact_store.py --cache-dir /ruta/ssd/eduai-cache prune --target-mb 5000
    # Solo con confirmación explícita y sin procesos que estén usando archivos:
    python training/eduai-local/efficiency/artifact_store.py --cache-dir /ruta/ssd/eduai-cache prune --target-mb 5000 --apply

Los modelos fijados no se borran. Esta versión no comprueba sesiones de inferencia activas; detén el motor antes de aplicar la limpieza. Ante un archivo .index.lock remanente, comprueba el estado del proceso antes de intervenir manualmente.

## Bonsai nativo

En octubre de 2026 PTQ1_0 y PQ2_0 siguen requiriendo el fork PrismML; Q2_0 puede funcionar con llama.cpp oficial reciente que incluya las transformaciones del modelo. Consulta la tabla de compatibilidad actualizada. El probe V2 se restringe a PTQ1_0 y al ejecutable llama-cli instalado y revisado por el operador.

Solo verifica los hashes del modelo y del ejecutable, SIN ejecutarlo:

    python training/eduai-local/efficiency/native_bonsai_probe.py --cache-dir /ruta/ssd/eduai-cache --model-id bonsai2-4b --model-sha256 SHA_MODELO --binary /ruta/prism/llama-cli --binary-sha256 SHA_BINARIO --release-id prism-b10777-e3de715

Smoke test opcional CPU, con prompt sintético y sin GPU:

    python training/eduai-local/efficiency/native_bonsai_probe.py --cache-dir /ruta/ssd/eduai-cache --model-id bonsai2-4b --model-sha256 SHA_MODELO --binary /ruta/prism/llama-cli --binary-sha256 SHA_BINARIO --release-id prism-b10777-e3de715 --run-cpu-smoke --context 512 --tokens 32 --timeout 120

El release-id es una afirmación del operador, no prueba de procedencia. Contrasta hashes con fuente oficial y revisa el ejecutable. El smoke puede consumir recursos, fallar o terminar con una salida incorrecta. Un código de salida cero NO certifica calidad ni compatibilidad. No medir como ahorro de RAM hasta ejecutar benchmarks.

## Pruebas

    python -m unittest discover -s training/eduai-local/efficiency -p 'test_*.py' -v

Son pruebas offline con modelos y binarios ficticios; no cargan pesos reales.

## Pendiente

Medidas RSS/VRAM peak, tokens por segundo, cold/warm load, page faults, verificación de licencias, gestor de servicios locales autenticados y sincronización opcional a almacenamiento remoto. El navegador no posee acceso general a carpetas SSD del sistema por diseño.

Referencias: https://github.com/PrismML-Eng/Bonsai-demo/blob/main/BACKEND-SUPPORT.md y https://prismml.com/news/bonsai-2-family .
