# Kaggle · EDUAI Model Factory · fase 1

Este módulo inicia **una prueba de integración** con EDUAI Nano. No entrena un modelo utilizable en producción: `example-instructions.jsonl` tiene solo 15 ejemplos. No subir conversaciones, datos de estudiantes, claves ni archivos privados a Kaggle.

## Antes de ejecutar

1. En Kaggle, crear un **Notebook privado** con nombre `EDUAI-Model-Factory-V1`.
2. En Settings, elegir GPU (T4 si está disponible, o P100) y habilitar Internet.
3. Importar `EDUAI_Model_Factory_Kaggle_Phase1.ipynb` de esta carpeta o ejecutar sus celdas.
4. Detener la sesión de GPU al terminar. No habilitar datasets públicos ni publicar el notebook con datos personales.

El notebook clona esta rama de desarrollo, instala requisitos de la fábrica, valida el corpus y ejecuta un entrenamiento mínimo con QLoRA. Guarda los resultados en `/kaggle/working/eduai-nano-smoke-lora`.

## Resultado esperado

- `adapter_config.json` y `adapter_model.safetensors` (o equivalente), si el entrenamiento realmente termina.
- `eduai-training-manifest.json`, generado por el entrenamiento existente.
- `kaggle-smoke-report.json` con perfil, hash del dataset, versiones, GPU y estado final.
- Un ZIP del adaptador para respaldo privado, generado únicamente tras completar el entrenamiento.

**Ningún resultado se marca como validado para producción.** El entrenamiento inicial no modifica Supabase, Vercel ni el router de EDUAI. El modelo requiere otro dataset, evaluación held-out, exportación GGUF verificada y revisión de licencia antes de distribución.

## Comprobaciones sin GPU

Desde la raíz del repositorio:

```bash
python training/eduai-local/kaggle/smoke_train.py --dry-run
python -m unittest discover -s training/eduai-local/kaggle -p 'test_*.py' -v
```

## Siguiente hito

Fase 2: dataset curado y versionado; train/validation/test separados, comparación con modelo base, seguimiento de métricas y exportación GGUF Q4_K_M con `llama.cpp` fijado a un commit probado. La integración con Supabase Candidate Lab se hará después de verificar artefactos y no aceptará puntuaciones arbitrarias del cliente.
