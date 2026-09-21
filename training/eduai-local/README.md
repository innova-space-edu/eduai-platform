# EDUAI Local Model Factory

Esta carpeta contiene la ruta reproducible para crear una familia propia de modelos EDUAI sin convertir los notebooks escolares en máquinas de entrenamiento.

## Arquitectura

- **Corpus/RAG:** `scripts/build-eduai-local-corpus.mjs` indexa la capa de desarrollo completa: `app/`, `components/`, `lib/`, `docs/`, `scripts/`, `supabase/`, `data/`, workflows y archivos de configuración. El mismo proceso genera un Knowledge Pack cacheable en el navegador.
- **Fine-tuning:** LoRA/QLoRA aprende comportamiento estable: selección de herramientas, formatos, estilo EDUAI, límites y respuestas estructuradas.
- **Inferencia:** los artefactos finales se convierten a GGUF, se cuantizan y se prueban en `admin/model-lab` con wllama.
- **Producción:** permanece bloqueada hasta pasar benchmark, seguridad y Production Gate.

## Familia de entrenamiento

`profiles.json` define tres targets que comparten dataset y reglas:

- **EDUAI Nano:** 350M, pensado para CPU/WASM y equipos básicos.
- **EDUAI Lite:** 1.2B, target por defecto para 8 GB RAM.
- **EDUAI Performance:** 2.6B, pensado para equipos como 8 GB RAM + 4 GB VRAM o superiores.

Esto permite mantener la misma especialización de EDUAI con distintos presupuestos de memoria y velocidad.

## Entrenamiento

Usar una máquina con GPU. No ejecutar este proceso en un notebook i5/8 GB destinado a usuarios.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r training/eduai-local/requirements.txt

# Perfil recomendado por defecto
python training/eduai-local/train_lora.py \
  --profile eduai-lite \
  --dataset training/eduai-local/example-instructions.jsonl \
  --load-in-4bit

# Variante de mayor capacidad
python training/eduai-local/train_lora.py \
  --profile eduai-performance \
  --dataset training/eduai-local/example-instructions.jsonl \
  --load-in-4bit
```

El archivo de ejemplo es solo una prueba de tubería. Para un modelo real hay que construir y revisar un dataset de instrucciones suficientemente grande. El código completo del repositorio debe permanecer principalmente en RAG/Knowledge Pack, no memorizarse en los pesos.

## Datos

El corpus automático no incorpora conversaciones ni datos de estudiantes por defecto. Los archivos con nombres de secretos se omiten y las líneas con apariencia de credencial se redactan.

## Knowledge Pack

El Knowledge Pack generado en build puede instalarse desde Model Lab. Se divide en shards de aproximadamente 1,5 MB para evitar respuestas serverless gigantes, se reconstruye en IndexedDB y el runtime local busca fragmentos relevantes antes de generar una respuesta. El panel compara el commit instalado con el build actual y avisa si el pack está desactualizado. El modelo devuelve además la lista de archivos usados como contexto.

## Merge y exportación GGUF

Después del entrenamiento se puede producir un candidato ejecutable por wllama:

```bash
python training/eduai-local/merge_lora.py \\
  --adapter artifacts/ai/eduai-lite-lora \\
  --output artifacts/ai/eduai-lite-merged

LLAMA_CPP_DIR=/ruta/a/llama.cpp \\
  bash training/eduai-local/export_gguf.sh \\
  artifacts/ai/eduai-lite-merged \\
  artifacts/ai/eduai-lite-Q4_K_M.gguf \\
  Q4_K_M
```

El exportador calcula SHA-256 y crea un manifiesto del artefacto. Los modelos propios generados con LoRA/QLoRA se cuantizan de forma normal; no deben etiquetarse como QAD salvo que se haya ejecutado un proceso de entrenamiento cuantizado específico.

## Siguiente artefacto

Después de entrenar:

1. fusionar el adaptador LoRA con el modelo base;
2. convertir el modelo fusionado a GGUF mediante llama.cpp;
3. producir cuantizaciones compatibles con cada perfil;
4. registrar el GGUF y su SHA-256 como candidato en Model Lab;
5. comparar calidad, RAM, VRAM, latencia y estabilidad antes de promoción.

Estado: Model Factory v3 · familia multi-hardware + Knowledge Pack local shardeado.

Validación CI: matriz multi-hardware + Knowledge Pack v3.

## Quality Gate

La promoción de un modelo propio se valida contra `eval-cases.jsonl`. La suite separa entrenamiento de evaluación y contiene casos de privacidad, no alucinación, navegación de código, routing, comportamiento offline y seguridad de herramientas.

Ejemplo usando LM Studio, llama.cpp u otro endpoint OpenAI-compatible local:

```bash
python training/eduai-local/evaluate_openai_compatible.py \
  --profile eduai-lite \
  --base-url http://localhost:1234/v1 \
  --model eduai-lite
```

Umbrales iniciales:

- EDUAI Nano: 70%.
- EDUAI Lite: 80%.
- EDUAI Performance: 85%.

Además, ningún perfil aprueba si falla un caso marcado como crítico. El reporte se guarda por defecto en `artifacts/ai/<perfil>-evaluation.json`.

### Quality Gate dentro de Model Lab

Además del evaluador OpenAI-compatible, Model Lab puede ejecutar un Quality Gate directamente sobre el modelo cargado en el navegador, incluido un GGUF propio seleccionado desde el disco.

La suite del navegador comprueba, entre otros puntos:

- privacidad y exclusión de datos de estudiantes;
- no afirmar acciones que ninguna herramienta confirmó;
- comportamiento correcto sin Internet;
- exclusión de secretos;
- actualización del Knowledge Pack cuando cambia el commit;
- no inventar rutas de código;
- separación entre RAG y fine-tuning;
- fallback cuando falta memoria.

Los casos críticos bloquean la promoción aunque la puntuación global supere el umbral. Si el modelo aprueba, Model Lab registra localmente el candidato junto con score, RAM, VRAM, WebGPU y fecha de validación. Este registro vive solo en el navegador y no publica ni despliega el modelo.

## Pérdida assistant-only

Por defecto, `train_lora.py` enmascara los tokens de `system` y `user` con `-100` y calcula la pérdida solo sobre las respuestas del `assistant`. Esto concentra la capacidad LoRA en el comportamiento que EDUAI debe aprender, en vez de gastar gradiente reproduciendo el prompt.

Para un experimento que necesite pérdida sobre toda la conversación se puede activar explícitamente:

```bash
python training/eduai-local/train_lora.py --profile eduai-lite --train-on-prompts
```

El manifiesto de entrenamiento registra `assistantOnlyLoss` para que el artefacto sea trazable.

