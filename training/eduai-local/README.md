# EDUAI Local Model Factory

Esta carpeta contiene la ruta reproducible para crear un modelo propio pequeño de EDUAI sin convertir los notebooks escolares en máquinas de entrenamiento.

## Arquitectura

- **Corpus/RAG:** el script `scripts/build-eduai-local-corpus.mjs` indexa `app/`, `components/`, `lib/` y `docs/` en cada build. Esto representa conocimiento que cambia con el repositorio.
- **Fine-tuning:** LoRA/QLoRA aprende comportamiento estable: selección de herramientas, formatos, estilo EDUAI, límites y respuestas estructuradas.
- **Inferencia:** el artefacto final se convierte a GGUF, se cuantiza y se prueba en `admin/model-lab` con wllama.
- **Producción:** permanece bloqueada hasta pasar benchmark, seguridad y Production Gate.

## Entrenamiento

Usar una máquina con GPU. No ejecutar este proceso en un notebook i5/8 GB destinado a usuarios.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r training/eduai-local/requirements.txt

python training/eduai-local/train_lora.py \
  --base-model LiquidAI/LFM2.5-350M \
  --dataset training/eduai-local/example-instructions.jsonl \
  --output artifacts/ai/eduai-lite-lora \
  --load-in-4bit
```

El archivo de ejemplo es solo una prueba de tubería. Para un modelo real hay que construir y revisar un dataset de instrucciones suficientemente grande; el código completo del repositorio debe permanecer principalmente en RAG, no memorizarse en los pesos.

## Datos

El corpus automático no incorpora conversaciones ni datos de estudiantes por defecto. Los archivos con nombres de secretos se omiten y las líneas con apariencia de credencial se redactan.

## Siguiente artefacto

Después de entrenar:

1. fusionar el adaptador LoRA con el modelo base;
2. convertir el modelo fusionado a GGUF mediante las herramientas de llama.cpp;
3. cuantizar a Q4_K_M;
4. registrar el GGUF como candidato en Model Lab;
5. comparar calidad, RAM, latencia y estabilidad antes de promoción.

Estado: Model Factory v1 · entrenamiento separado de la inferencia local.
