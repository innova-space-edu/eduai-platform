# Entrenamiento EDUAI y feedback

## Estado comprobado

Piloto privado `esthefano/eduai-lite-training-pilot`, completado en Tesla T4 con QLoRA, 15 ejemplos sintéticos y 24 pasos. Modelo base LiquidAI/LFM2.5-1.2B-Instruct, revisión b9d816ab510f9a28dca37cb182e9da8b0226e13c. Suite heurística de 13 casos: base 23,08%, adaptador 38,46%, cuatro fallos críticos. Esta muestra valida el circuito, no calidad pedagógica ni generalización. El adaptador NO se promueve a producción. El notebook separado `eduai-lite-pilot-artifacts` conserva solo el adaptador final y reportes para respetar el límite de 256 MB del puente.

## Aportes de uso real

- `/training-contribution`: autorización específica, voluntaria y revocable, exclusivamente para adultos con fecha de nacimiento registrada. No se activa masivamente ni se importa el historial previo.
- `runAIText` y `runAIStructured` recopilan candidatos de texto después de una generación nueva cuando existe autorización. Solo se toma la última instrucción y su respuesta; no el system prompt ni el historial. Cachés, streaming, llamadas directas a SDK y modelos locales no están capturados automáticamente: sus respuestas se pueden aportar explícitamente con feedback.
- Feedback visible en Claw, Mira, Work, SuperAgent, Notebook/Pro, Workspace, Paper, AI Social, Redactor, Investigador, Matemático, Traductor y el planificador. No se agrega al chat entre personas. Algunos módulos requieren reescribir una pregunta autónoma para no copiar sus fuentes privadas.
- Útil o corregida queda pendiente. Incorrecta queda rechazada. Corregir también rechaza el original existente. Aprobar exige revisión humana pedagógica, de privacidad y de derechos de uso; no basta con que otro chatbot considere correcta una respuesta.
- Filtros conservadores rechazan contactos, identificadores, credenciales y señales sensibles. No constituyen anonimización garantizada. El revisor verifica también nombres y cualquier dato personal que un patrón no pueda detectar.
- Archivos, voces, imágenes, video, conversaciones privadas y datos de estudiantes no se envían en bruto. Este entrenamiento es de texto/comportamiento; no entrena un generador audiovisual.

## Comparación A/B de respuestas en los chats

- El chat sigue atendiendo la solicitud original. Una consulta como «¿puedes revisar si existe una herramienta?» no se envía al corrector ortográfico; esa herramienta requiere intención explícita de editar texto.
- En «Mejorar EDUAI → Comparar 2 respuestas», la respuesta A es la que ya entregó el chat. El usuario solicita la generación de una respuesta B alternativa que debe resolver **la misma instrucción**. Esta segunda llamada es opcional, no se ejecuta en cada mensaje y no sustituye la respuesta visible.
- Para comparar se exige sesión, consentimiento vigente de un adulto y un par pregunta/respuesta compatible con los filtros de privacidad. Los chats con fuentes no autorizadas o datos sensibles no deben aportarse. Si la pregunta requiere documentos o navegación que el generador alternativo no tiene, debe reconocer esa limitación.
- La generación B usa el Gateway con "captureTraining: false": **ninguna respuesta no seleccionada se añade automáticamente** al conjunto de entrenamiento.
- Al seleccionar A, se registra la respuesta actual como ejemplo útil; al seleccionar B, se registra como corrección y se rechaza el candidato original, si existe. El elegido queda pendiente de revisión humana y solo después podrá incluirse en la exportación supervisada. Si ambas son incorrectas, puede escribirse la respuesta correcta.
- Esta versión recopila ejemplos supervisados a partir de la preferencia; **no crea un dataset DPO de pares preferido/rechazado**. Para entrenamiento de preferencias propiamente dicho se requiere una estructura separada, verificación de alineación y revisión de privacidad antes de la exportación.
- La comparación no acredita veracidad: el revisor debe comprobar relevancia, exactitud, derechos y que la respuesta elegida atienda realmente la pregunta.

## Operación

Administrador → Model Lab → Model Factory → Aprendizaje con aportes y correcciones. Revisar candidatos, aprobar o excluir y exportar JSON. El RPC de exportación es exclusivo de service_role y el endpoint verifica admin_emails; bloquea filas y autorizaciones durante la instantánea. Mantiene pregunta y sus respuestas alternativas en una misma partición para evitar fugas entre entrenamiento y validación.

    python training/eduai-local/build_kaggle_bundle.py --profile eduai-lite --export eduai-reviewed-training.json --output eduai-kaggle.py

El script es autocontenido, sin credenciales de EduAI, Supabase ni GitHub. Se prepara como notebook privado de Kaggle con T4 e Internet para descargar el modelo y dependencias. El empaquetador acepta eduai-nano, eduai-lite y eduai-performance, además de --max-steps (1–1000). El piloto usa por defecto 24 pasos; no representa una receta de entrenamiento de producción. El corpus revisado debe ampliarse y ajustarse con una evaluación separada por tareas antes de cualquier promoción.

El runner mide la misma suite antes y después, registra revisión del modelo, GPU, semilla, SHA-256 y artefactos; si hay partición de validación exportada mide además su pérdida assistant-only (hasta 50 ejemplos compatibles, máximo 1024 tokens). Ningún resultado se promueve automáticamente. Las verificaciones por palabras clave no sustituyen una evaluación humana de exactitud o planificación.

## Revocación y retención

Los candidatos caducan a los 90 días y se excluyen de revisión/exportación; el panel administrativo elimina físicamente los caducados al abrirse. No hay un cron de purga independiente instalado. Retirar autorización elimina todos los candidatos del propietario e invalida sus exportaciones. Actualizar/rechazar o eliminar un candidato también invalida exportaciones anteriores. Una descarga ya realizada y los pesos ya entrenados no se pueden retirar automáticamente; revisar los lotes revocados antes de reutilizar sus modelos.

Tablas ai_training_consents, ai_training_candidates, ai_training_exports y ai_training_runs: RLS activo; ningún acceso anónimo. El usuario solo lee su autorización/candidatos e inserta generaciones propias pendientes bajo autorización; las autorizaciones, revisiones, feedback y exportaciones pasan por rutas de servidor autenticadas. No se entregan identificadores de usuarios al dataset exportado.

## Validación

`npm run test:training`: filtros, autorización, exclusión de instrucciones internas/adjuntos, estructuras corruptas, partición estable y exclusión del original. Forma parte de `test:ai-core`. Prueba transaccional real con rol authenticated/service_role, rollback: aislamiento, bloqueo de aprobación/exportación desde cliente, exportación aprobada, invalidación por corrección y purga por retirada.
