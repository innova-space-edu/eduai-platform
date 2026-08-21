# EduAI Core — Preview Gate

Este archivo documenta el punto de control usado para generar el Preview final de revisión sin modificar el código validado.

- Código base validado: `760bebd3df624561051c32dd638d23601bcffd57`
- AI Core CI: success, incluyendo `npm run build` completo con Node 22.
- Creator Hub CI: success.
- Validación curricular MINEDUC: success.
- PR principal: #94, permanece DRAFT.
- No fusionar a `main` hasta la revisión manual y aprobación explícita del usuario.

## Correcciones incluidas antes de este gate

- `ProcessVideoJobInput` conserva `provider` y `model`.
- Polling de Veo conserva el modelo del job.
- Router de video free-first canónico: WAN → HF Gradio → HF legacy → Google Veo.
- Los scripts de build son idempotentes y no duplican imports WAN/HF.
- Jobs nuevos no preasignan Google; el router selecciona proveedor.
- Fallos de video no consumen el cupo diario.
- Polling autenticado de Preview soporta Google, WAN y HF Gradio.
- Video Studio está disponible en Agentes.
- Image Studio queda Gemini 3.1-first.
- Premium Personal y recuperación de jobs están incorporados al rollout.
- Model Lab incluye registro dinámico y estado de Video/Premium Personal.

Este commit es solo documental y sirve para disparar un nuevo Preview desde el estado de código ya validado.
