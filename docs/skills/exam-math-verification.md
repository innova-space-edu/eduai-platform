# Skill: revisión matemática de evaluaciones

- Entrada: enunciado, respuesta esperada, resultado final y pasos de solución; nunca código generado por IA.
- Control automático de consistencia: `lib/exam/answer-consistency.mjs` se ejecuta desde la calidad de preguntas durante generación y publicación. Bloquea contradicciones detectables en la configuración de Tales admitida y borradores de solución.
- Verificación independiente: `public/exam-python-check.py` utiliza Python y fracciones exactas. `ExamPythonReview` ejecuta el módulo en un Web Worker con Pyodide, seleccionando una pregunta o todas. No se transmite el texto a un servicio de IA. La primera carga descarga el runtime de Pyodide.
- Alcance: igualdades aritméticas explícitas y proporcionalidad de Tales bajo una configuración reconocida. No se certifican pasos algebraicos generales ni demostraciones geométricas. Las comprobaciones parciales y entradas no soportadas deben quedar explícitas.
- No usar eval, exec, sympify de entrada arbitraria ni código aportado por el modelo. Ampliar con casos acotados y regresiones.
- Pruebas: `python scripts/test-exam-python-check.py` y `node --test scripts/test-exam-generation-contract.mjs`.

## Flujo de corrección
- Propuesta exacta de Tales calculada en Python, aplicable por el docente, con respuesta, resultado, explicación y pasos. Rúbrica y puntaje se preservan y requieren revisión manual.
- Para igualdades inconsistentes, se muestran los valores exactos de sus miembros. No se reemplaza una pauta general sin una solución independiente.
- Confirmación explícita Corregido tras una nueva verificación; cambios en los campos relevantes invalidan la confirmación. Estado en el borrador. La publicación de asignaturas matemáticas/científicas ejecuta Python en el navegador y la API vuelve a comprobar consistencia reconocida y confirmación remitida.
