# EduAI — Generador de exámenes docentes v2

## Objetivo

Generar cada pregunta junto con su pauta oficial en el mismo contexto de IA y mantener la pauta separada visualmente en la interfaz docente.

## Mejoras

- Preguntas de alternativas con `answerText`, `explanation`, `solutionSteps` y `distractorRationales`.
- Preguntas V/F con respuesta declarada y fundamento.
- Preguntas de desarrollo con `modelAnswer`, `expectedLatex`, `explanation`, `solutionSteps` y rúbrica.
- Agente interno de revisión de calidad: si detecta alternativas duplicadas, vacías o incoherencias estructurales, solicita hasta dos reparaciones al mismo proveedor antes de devolver el lote.
- Panel separado **Clave de respuestas** en creación y edición.
- Seguridad: la API pública del examen elimina la pauta oficial antes de responder al estudiante.
- Seguridad: al entregar, la corrección usa preguntas oficiales recuperadas desde Supabase y no confía en las preguntas enviadas por el navegador.

## Archivos

- `app/api/agents/exam-generate/route.ts`
- `app/api/agents/examen-docente/route.ts`
- `app/examen/crear/page.tsx`
- `app/examen/editar/[id]/page.tsx`
- `lib/exam/question-quality.ts`

## Flujo

1. El docente solicita preguntas por IA.
2. El proveedor devuelve pregunta y pauta dentro del mismo objeto JSON.
3. `question-quality.ts` normaliza y valida la estructura.
4. Si hay errores bloqueantes, el agente interno pide reparar el lote.
5. La interfaz muestra primero las preguntas y luego una clave separada con respuestas y explicaciones.
6. Al publicar, la pauta queda guardada en `teacher_exams.questions`.
7. El estudiante recibe una versión segura sin respuestas oficiales.
8. Al entregar, el servidor recupera la pauta oficial desde Supabase para corregir.
