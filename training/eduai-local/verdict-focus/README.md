# EDUAI — piloto corto de veredicto

Experimento de entrenamiento; no modifica la página ni despliega modelos.

## Ejecutar en el mismo notebook privado de Kaggle

1. Descarga `piloto_veredicto.ipynb` mediante **Download raw file** en GitHub e impórtalo en el editor de Kaggle. Conserva el notebook privado y su dataset de diagnóstico.
2. En **Input**, debe estar el dataset privado que contiene `diagnostico_payload.json` y el `adapter_model.safetensors` del checkpoint 8. También se admite el ZIP original `EDUAI_DIAGNOSTICO_DATOS_PRIVADOS.zip`. No pegues pesos dentro del código.
3. Activa **GPU T4** e **Internet**. Ejecuta **Save Version → Save & Run All**. El código pesa menos de 1 MB.
4. Entrega `/kaggle/working/eduai-qwen-veredicto-foco/informe_veredicto.zip`. Conserva también la carpeta completa para reanudar.

Puedes copiar el contenido de `piloto_veredicto.py` en una sola celda en lugar de importar el notebook. No ejecutes simultáneamente el diagnóstico anterior.

## Qué cambia

Se continúa experimentalmente el checkpoint 8 de Qwen3-4B-Instruct-2507: ocho actualizaciones nuevas, acumulación 16, 128 ejemplos nuevos. Son 48 comprobaciones completas, 32 veredictos directos y 48 controles de identificación de operandos/resolución. Los 80 veredictos están equilibrados. Se aumenta el peso del veredicto y de los datos originales dentro de la pérdida, sin entrenar sobre el prompt.

Los ejemplos usan signos, ceros, varias redacciones y paréntesis opcionales desde el inicio. El evaluador calcula expresiones mediante un AST restringido y aritmética racional; acepta equivalencias de formato pero exige conservar los operandos originales. No ejecuta texto mediante eval.

Se reutilizan las respuestas originales y del padre para comparar en la misma validación observada. Solo si el candidato llega a 22/24, mejora al original, tiene cero aceptaciones falsas y retención de al menos 10/12 sin retroceso, se evalúa un banco nuevo de 36 casos contra el modelo original. Ese banco se mantiene reservado hasta entonces. No demuestra generalización matemática amplia y no autoriza despliegue: un aprobado queda pendiente de réplica.

## Tiempo y recuperación

El presupuesto por ejecución es 20 minutos después de cargar el modelo; la descarga y preparación consumen tiempo adicional. Es un límite cooperativo entre operaciones, no una interrupción exacta a los 20 minutos. Si se pausa, **no vuelvas a empezar**: guarda toda la carpeta de salida, incluidos `step-*`, y añádela como Input privado en la siguiente ejecución. El script recupera pesos, optimizador, scaler, RNG y respuestas ya generadas; comprueba huellas y hashes. Una actualización que no alcanzó a guardarse se repite.

El ZIP del informe no incluye pesos ni optimizador y no basta para reanudar. Guarda la carpeta completa aunque el candidato sea rechazado. No sustituye el modelo original ni el verificador exacto.

## Validación del código

`python piloto_veredicto.py --self-test` comprueba signos, formatos, equilibrio, exclusión y reproducibilidad sin GPU. `python test_mask.py` comprueba las máscaras y pesos en 164 filas mediante un tokenizer simulado. Estos controles pasaron en CPU. La carga del tokenizer real, los pesos y el entrenamiento en T4 quedan pendientes; se validan antes de actualizar pesos.
