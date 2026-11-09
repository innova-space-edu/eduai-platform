# Correcciones R5 sobre EDUAI Nano/Lite

**Notebook Kaggle sin cambios de identidad:** `esthefano/eduai-nano-lite-refuerzo-corto-v4`.
**Código:** esta rama GitHub, en `training/eduai-local/math-r4/`.
**Estado:** solo código y pruebas CPU/CI; **NO se ha publicado ni ejecutado la receta R5 en Kaggle**.

## Defectos R4 corregidos

1. **Etiquetas e instrucciones incompatibles:** se regeneran por separado los ejemplos `final` y `trace`.
   - `final`: pregunta con solicitud expresa de una sola respuesta y etiqueta exactamente igual a la respuesta correcta.
   - `trace`: pregunta que solicita pasos y comprobación, con última línea `Respuesta final: ...`.
   - El generador valida el contrato individual y las pruebas recorren los 3.000 ejemplos del entrenamiento y todas las evaluaciones.
   - La mezcla de procedimientos se reduce del 65 % al 35 % para reforzar el formato de respuesta final.

2. **Menos de una época por etapa:** se elimina `max_steps=70/90` como presupuesto rígido. Se usan dos épocas por etapa, con cálculo previo de pasos y comprobación de que se recorrió al menos una época completa. Esta receta requiere más GPU que R4 y **no está validada aún en GPU**.

3. **Checkpoint elegido solo por pérdida:** se ordenan los checkpoints por rendimiento de **300 casos de validación** (50 por habilidad), ponderando las habilidades críticas y el repaso; la pérdida del entrenamiento queda solamente como desempate. Se guardan la etapa y la semilla seleccionadas, el diagnóstico de formato y el número de pasos efectivos.

4. **Errores de formato confundidos con errores matemáticos:** el evaluador registra `correct` (exactitud y formato), `semanticCorrect`, `formatErrors`, `truncated`, errores por categoría y ejemplos fallidos. El modelo puede acertar la matemática y fallar el contrato de «solo resultado», sin inflar la métrica principal.

5. **Pruebas antiguas reutilizadas:** las nuevas semillas de evaluación son `57021`, `57031` y `57041` y la nueva semilla de validación es `52011`. Las pruebas R2/V4 siguen como regresión histórica, nunca eligen checkpoints. El diagnóstico estructural también tiene una nueva semilla, pero **sigue siendo sintético**, no un benchmark externo independiente.

6. **Errores tardíos por longitud:** todos los ejemplos de entrenamiento de ambas etapas se tokenizan y se comprueban antes del primer paso del optimizador, y se reutilizan entre las tres semillas.

## Verificaciones sin GPU

```bash
python -m unittest discover -s training/eduai-local/math-r4 -p "test_*.py" -v
python training/eduai-local/math-r4/build_kaggle_bundle.py --out /tmp/eduai-r5-mismo-notebook
```

El `kernel-metadata.json` generado **debe mantener** `"id": "esthefano/eduai-nano-lite-refuerzo-corto-v4"`. Nada de esto crea otro notebook.

**No subir ni ejecutar R5 todavía:** antes revisar la CI, la duración y memoria estimadas en Kaggle y la disponibilidad GPU. **Nunca activar `productionReady` automáticamente**. El objetivo es comprobar aprendizaje real, no prometer 90 % sin evidencia.

## Limitaciones

La solución no corrige automáticamente las limitaciones de razonamiento de modelos 350M/1.2B. Los ejemplos siguen siendo sintéticos, con solapamiento de familias de plantillas; hay que validar generalización, seguridad y tareas reales con evaluaciones externas. La comparación entre versiones con baterías distintas no es directa.
