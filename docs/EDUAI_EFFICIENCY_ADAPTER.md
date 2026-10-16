# Universal Efficiency Adapter V1 — EDUAI Model Lab

## Estado
Experimental y aislado. Ninguna descarga, ejecución cloud o promoción automática. No convierte SSD o nube en RAM real.

## Capas
1. Catálogo: GGUF convencional ejecutable por wllama y referencias Bonsai 2 PTQ1_0 (2B=0,43 GB; 4B=0,95 GB; 9B=2 GB; 27B=5,95 GB, según PrismML).
2. Planificador: hardware RAM, VRAM indicada, almacenamiento libre del origen, cuota de caché, motor compatible, contexto y privacidad.
3. RAM/VRAM: ejecución activa y estados KV. SSD mantiene pesos fríos o, mediante mmap nativo, permite paginación a cargo del sistema operativo. No elimina caché KV ni activaciones.
4. Navegador: reutiliza la caché actual wllama con persistencia de StorageManager, sin controlar físicamente qué unidad SSD usa el sistema.
5. Nativo: Bonsai 2 usa Hadamard y kernels compatibles PrismML. El wllama actual no ejecuta PTQ1_0 y se rechaza expresamente ese modo. Instalar un GGUF solo no añade las operaciones del formato al motor.
6. Nube: almacenamiento frío y ejecución remota son conceptos distintos. Sin endpoint autenticado ni consentimiento, prohibida inferencia remota y transferencia de prompts.

## Primer prototipo funcional
- Panel privado en /admin/model-lab: elegir modelos actuales o Bonsai 2 y ver plan de admisión, alerta de RAM y cálculo heurístico.
- Ajuste opt-in para próximas cargas wllama: bajo RAM 4 GB n_ctx=1024 n_batch=32; 8 GB n_ctx=2048 n_batch=64; >=12 GB n_ctx=4096 n_batch=128.
- Caché actual de wllama se conserva; solicitar persistencia no garantiza cuotas ni evita todos los desalojos.
- Bonsai 2 y el servidor permanecen bloqueados hasta verificar runtime PrismML y endpoint auténtico.
- Los tamaños se refieren a pesos sin runtime, KV cache, activaciones o proyector visual opcional; las estimaciones de presupuesto son conservadoras y NO representan medidas RSS/VRAM.
- No hay descargas automáticas, sincronización de secretos ni promoción a producción.

## Optimización siguiente
- Ejecutable PrismML nativo pinneado a release con mmap y GPU offload verificado.
- Gestor de artefactos con hashes, shards, cuotas, LRU y cifrado si aplica, sin duplicados.
- Benchmark de calidad antes/después, tokens/s, peak RSS, peak VRAM, latencia frío/caliente, page faults y consumo real.
- Sensores y permisos de privacidad para router local-remoto, pendiente del servidor.
- Comparación Bonsai 2 2B/4B CPU 8 GB, 9B en 4 GB VRAM y 27B con RAM holgada, todos sujetos a benchmark.

## Referencias técnicas
https://prismml.com/news/bonsai-2-family
https://github.com/PrismML-Eng/Bonsai-demo/blob/main/BACKEND-SUPPORT.md
https://huggingface.co/prism-ml/Ternary-Bonsai-2-4B-gguf
https://github.com/ggml-org/llama.cpp/blob/master/tools/cli/README.md
https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist

## Pruebas
npx tsx scripts/test-eduai-efficiency-adapter.ts

Estas pruebas comprueban la política y las barreras de compatibilidad, no rendimiento real del hardware.
