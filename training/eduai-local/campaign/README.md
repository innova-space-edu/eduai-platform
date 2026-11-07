# Campaña rigurosa de fundamentos EDUAI v1

## Alcance

Experimento de ajuste supervisado con QLoRA sobre Nano (350M), Lite (1.2B) y Performance (2.6B). Tres semillas predeclaradas por perfil: 42, 1337 y 2026. No habilita el router de producción ni modifica los modelos de usuarios.

La base contiene **2.000 filas sintéticas programáticas**, no 2.000 tareas pedagógicas independientes. Son 100 familias de presentación con referencias comprobadas: cálculo entero/ecuaciones sencillas (1000), routing entre cinco herramientas (500), extracción de campos (200), cita de objetivos de práctica proporcionados (200), y conversión sin alteraciones de cinco fichas educativas originales a JSON (100). Los objetivos PR son de práctica y NO son OA oficiales. El experimento mide fundamentos y cumplimiento de formatos; no certifica que un modelo diseñe buenas planificaciones.

## Datos congelados

`dataset.py` reconstruye exactamente 1.400 ejemplos train, 300 validation y 300 test. Las veinte familias de cada categoría se ordenan por un hash de versión y se asignan 14/3/3; todas las variantes de una familia permanecen juntas. Se rechazan IDs/preguntas duplicadas o familias compartidas. Los hashes exactos están en `data/eduai-training/foundation-v1/manifest.json`. Los JSONL derivados se reconstruyen en Kaggle; no requieren datos privados ni una API de EduAI.

Quince desafíos matemáticos escritos separadamente evalúan transferencia a fracciones, porcentajes, probabilidad, prioridad de operaciones y casos límite. Nunca entran en entrenamiento/validación. La suite previa de 13 casos se conserva como regresión de arquitectura/privacidad; sus comprobaciones por palabras clave pueden dar falsos negativos y no sustituyen revisión humana.

Las familias programáticas aún comparten estructura y algoritmo. Por eso la incertidumbre se calcula de manera conservadora, agrupando por tarea/categoría y no tratando las 315 respuestas como observaciones independientes. Hay pocos grupos: los intervalos son exploratorios y no prueban generalización a producción.

## Entrenamiento

El presupuesto preregistrado en `config.json` fija dos épocas, learning rate 1e-4, batch 2, acumulación 8, máximo 1536 tokens sin truncado, evaluación/guardado cada 50 pasos y paciencia 2. La pérdida se calcula solo sobre assistant. Se conserva el checkpoint con menor pérdida en validation. El test final no se usa para elegir hiperparámetros, checkpoint ni semilla. La comparación entre semillas es descriptiva; no se elige la semilla que mejor rinde en test.

Los hashes de parámetros entrenables antes/después comprueban que cambiaron realmente. El informe conserva historial de loss, revisión exacta del modelo base, GPU, versiones, manifiesto de datos y hashes del código y del adaptador seleccionado. Las semillas no garantizan resultados idénticos entre diferentes versiones de CUDA o hardware.

La carga nativa rechaza pesos faltantes/inesperados; preserva rope_theta si la configuración reciente usa rope_parameters. Se admite el tokenizer BPE genérico cuando la metadata de Transformers 5 lo llama TokenizersBackend, manteniendo chat template y EOS. No se ejecuta código remoto de repositorios de modelos.

## Ejecución privada en Kaggle

    python training/eduai-local/campaign/test_campaign.py
    python training/eduai-local/campaign/matrix_bundle.py --preflight --output preflight.py
    python training/eduai-local/campaign/matrix_bundle.py --output campaign.py

El preflight de CPU comprueba tokenizer, longitudes y spans assistant de los tres perfiles. La matriz ejecuta un perfil tras otro, cada uno con tres semillas. Así son nueve entrenamientos dentro de un lanzamiento de GPU. Límite de 150 minutos por perfil; todo queda privado. El runner respeta ese presupuesto durante entrenamiento/inferencia, aunque descarga e instalación también dependen de Kaggle.

Cada perfil conserva reportes de baseline y de sus tres semillas; exporta solo el adaptador elegido por validation, para reducir tamaño. Las demás mediciones y hashes se mantienen. El notebook raíz publica `matrix-report.json` y `report-eduai-*.json`; un fallo queda marcado y no equivale a aprendizaje validado. Las carpetas selected-adapter incluyen los pesos finales.

## Evaluación docente pendiente

Se generan doce pares ciegos por perfil: seis solicitudes de Parvularia, Básica y Media, cada una sin/con un contexto fijo. El contexto de referencia es idéntico para baseline y candidato. Esto compara contexto proporcionado; NO es una auditoría del buscador RAG de producción. La clave de desenmascarado queda en un archivo ADMIN-ONLY que no se entrega a quienes puntúan.

    python training/eduai-local/campaign/review_blind.py --pairs blind-review.json --output rubric.csv

Dos docentes independientes puntúan exactitud, alineación al propósito, nivel, detalle aplicable, evaluación y seguridad (1–5), además de errores críticos. No se rellenan puntuaciones automáticamente. Una vez cerradas:

    python training/eduai-local/campaign/review_blind.py --pairs blind-review.json --key blind-key-ADMIN-ONLY.json --scores rubric.csv --output human-review.json
    python training/eduai-local/campaign/compare_reports.py report-eduai-nano.json report-eduai-lite.json report-eduai-performance.json --output comparison.json

## Decisión

Revisar ganancia por categoría, pérdida de validación, intervalos pareados, consistencia entre semillas, errores críticos y rúbricas. Una caída de loss o un cambio de pesos por sí solos no demuestra mejora. Ningún candidato se promueve automáticamente. Aún se exige revisión docente, benchmark del GGUF en hardware objetivo y decisión explícita del administrador. Si se rediseña la receta después de mirar test, se requiere una versión nueva y una prueba final renovada.
