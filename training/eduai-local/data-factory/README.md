# EDUAI Dataset Factory V1 — sin depender de Kaggle

El dataset inicial contiene **54 ejemplos sintéticos originales** en **18 familias de tareas**. No usa información de estudiantes ni conversaciones de usuarios. Todos tienen estado pendiente de revisión humana y requieren revisión pedagógica/técnica.

**No es un dataset de producción.** El manifiesto mantiene training_ready=false y production_ready=false incluso si se editan las etiquetas.

## Comprobación y generación sin GPU

Desde la raíz del repositorio:

    python training/eduai-local/data-factory/build_dataset.py --check
    python -m unittest discover -s training/eduai-local/data-factory -p 'test_*.py' -v
    python training/eduai-local/data-factory/build_dataset.py

La salida se guarda en artifacts/ai/dataset-factory-v1/, ignorada por Git:
- train.jsonl: 36 ejemplos, 12 familias.
- validation.jsonl: 9 ejemplos, 3 familias.
- test.jsonl: 9 ejemplos, 3 familias.
- manifest.json: semillas, hashes SHA-256, recuentos, IDs y familias.

El reparto es por familia completa y es determinista. El JSONL generado tiene solo el campo messages, compatible con train_lora.py.

## Controles de privacidad y calidad

El validador bloquea JSONL incorrecto, roles inválidos, IDs duplicados, prompts duplicados normalizados, correos, formatos de RUT, tokens con patrones habituales y coincidencias exactas con eval-cases.jsonl.

**Limitación:** este filtrado NO garantiza ausencia de datos personales, ni descubre todas las paráfrasis del holdout. Hay que revisar fuentes, exactitud pedagógica, licencias y seguridad, y añadir deduplicación semántica.

## Política de uso

- Train: único conjunto que podría utilizarse para cambiar pesos, después de aprobación y ampliación del corpus.
- Validation: medir y seleccionar ajustes; nunca se entrena con este conjunto.
- Test: reservado para evaluación final; no se debe inspeccionar repetidamente para optimizar.
- eval-cases.jsonl: batería Quality Gate separada, no se incorpora al corpus.

Este PR no cambia train_lora.py, la base de datos, Vercel ni Kaggle. La aprobación del dataset debe contar con un gate vinculante al entrenamiento en la siguiente fase.

## Próximos hitos

1. Revisión humana de los 54 ejemplos sin aprobaciones automáticas.
2. Ampliación con ejemplos autorizados, trazables y diversos.
3. Escaneo de similitud semántica y riesgos de contaminación.
4. Benchmark independiente del modelo base y modelo afinado.
5. Posterior ejecución en Kaggle/Colab/GPU cuando esté disponible.
