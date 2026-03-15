/**
 * app/api/agents/transcript-editor/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * AGT-EditorTranscript — EduAI Audio Lab
 *
 * Toma una transcripción cruda y la transforma según la operación pedida.
 *
 * Body esperado:
 *   {
 *     transcriptionId: string,   // UUID de audio_transcriptions (para guardar resultado)
 *     transcript: string,        // texto de la transcripción
 *     operation: "clean" | "notes" | "minutes" | "summary" | "actions" | "custom",
 *     customInstruction?: string // para operation="custom"
 *   }
 *
 * Operaciones:
 *   clean   → versión limpia: corrige puntuación, elimina muletillas, formatea
 *   notes   → clase grabada → apuntes estructurados con títulos y conceptos
 *   minutes → reunión → acta formal con asistentes, acuerdos y pendientes
 *   summary → resumen ejecutivo en 5-10 puntos clave
 *   actions → lista de tareas/acciones mencionadas con responsable y plazo si los hay
 *   custom  → instrucción libre del usuario
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callAI } from "@/lib/ai-router-v4"

export const runtime     = "nodejs"
export const maxDuration = 60

type Operation = "clean" | "notes" | "minutes" | "summary" | "actions" | "custom"

// ── Prompts por operación ─────────────────────────────────────────────────────
const SYSTEM_PROMPTS: Record<Operation, string> = {
  clean: `Eres un editor de texto experto. Recibes una transcripción literal de audio y la limpias manteniendo toda la información.

TU TRABAJO:
- Corregir puntuación y ortografía
- Eliminar muletillas excesivas (eh, um, o sea repetido, etc.) conservando el tono natural
- Separar en párrafos lógicos según el tema
- Conservar las etiquetas de hablante [Hablante 1], [Hablante 2] si existen
- NO cambiar el contenido ni agregar información

Responde solo con el texto limpio, sin comentarios adicionales.`,

  notes: `Eres un experto en tomar apuntes académicos. Recibes la transcripción de una clase o explicación y la conviertes en apuntes estructurados.

FORMATO DE APUNTES:
# Tema principal
## Subtema 1
- Concepto clave: definición o explicación
- Punto importante
- **Dato relevante**

> 💡 Tip o idea destacada

### Ejemplos mencionados
...

## Conceptos para repasar
- Lista de términos o ideas que merecen revisión

Usa markdown. Sé específico y útil. No incluyas conversación informal, solo el contenido educativo.`,

  minutes: `Eres un secretario ejecutivo experto en redactar actas de reunión. Recibes la transcripción de una reunión y generas un acta formal.

FORMATO DEL ACTA:
# ACTA DE REUNIÓN
**Fecha:** [si se menciona, sino: por determinar]
**Participantes:** [lista de hablantes identificados]
**Duración aproximada:** [si se infiere]

## Orden del día
[Temas tratados en orden]

## Desarrollo
### [Tema 1]
[Resumen de lo discutido]

### [Tema 2]
...

## Acuerdos y decisiones
1. [Acuerdo tomado] — Responsable: [si se menciona]
2. ...

## Tareas y pendientes
- [ ] [Tarea] — Responsable: [nombre] — Plazo: [fecha si se menciona]

## Próxima reunión
[Si se agenda, sino omitir]

Usa markdown. Sé formal y preciso.`,

  summary: `Eres un experto en síntesis de contenido. Recibes una transcripción y generas un resumen ejecutivo claro y útil.

FORMATO:
## Resumen ejecutivo

**Tema central:** [una frase]

**Puntos principales:**
1. [punto clave 1]
2. [punto clave 2]
...hasta 8 puntos máximo

**Conclusión:**
[2-3 frases con la idea principal y el resultado o mensaje final]

---
*Duración estimada de lectura: X min*

Sé conciso. Cada punto debe aportar información única y relevante.`,

  actions: `Eres un extractor de tareas y compromisos. Recibes una transcripción y extraes SOLO las tareas, acciones y compromisos mencionados.

FORMATO:
## Tareas y acciones identificadas

### Tareas concretas
- [ ] **[Tarea]** — Responsable: [nombre o "no especificado"] — Plazo: [fecha o "no especificado"]

### Compromisos mencionados
- [Compromiso o promesa hecha durante la conversación]

### Temas pendientes de definir
- [Algo que quedó sin resolver o requiere seguimiento]

Si no hay tareas claras en la transcripción, indicarlo brevemente.
Usa markdown.`,

  custom: `Eres un asistente experto en procesamiento de texto. Recibes una transcripción de audio y una instrucción del usuario. 
Ejecuta exactamente lo que el usuario pide con precisión y calidad profesional.
Responde en el mismo idioma de la transcripción, salvo que el usuario pida otro idioma.`,
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // ── Validar body ──────────────────────────────────────────────────────────
  let body: {
    transcriptionId?: string
    transcript?: string
    operation?: string
    customInstruction?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const { transcriptionId, transcript, operation, customInstruction } = body

  if (!transcript?.trim()) {
    return NextResponse.json({ error: "transcript es requerido" }, { status: 400 })
  }

  const validOps: Operation[] = ["clean", "notes", "minutes", "summary", "actions", "custom"]
  const op = (operation || "clean") as Operation

  if (!validOps.includes(op)) {
    return NextResponse.json({ error: `operación inválida: ${operation}` }, { status: 400 })
  }

  if (op === "custom" && !customInstruction?.trim()) {
    return NextResponse.json({ error: "customInstruction requerido para operación 'custom'" }, { status: 400 })
  }

  // ── Verificar que la transcripción pertenece al usuario (si se provee ID) ──
  if (transcriptionId) {
    const { data: record } = await supabase
      .from("audio_transcriptions")
      .select("id, user_id")
      .eq("id", transcriptionId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!record) {
      return NextResponse.json({ error: "Transcripción no encontrada" }, { status: 404 })
    }
  }

  try {
    // ── Construir el prompt ───────────────────────────────────────────────────
    const systemPrompt = SYSTEM_PROMPTS[op]
    const userMessage  = op === "custom"
      ? `INSTRUCCIÓN: ${customInstruction}\n\nTRANSCRIPCIÓN:\n${transcript.slice(0, 25000)}`
      : `TRANSCRIPCIÓN:\n${transcript.slice(0, 25000)}`

    const result = await callAI(
      [
        { role: "system",  content: systemPrompt },
        { role: "user",    content: userMessage  },
      ],
      { maxTokens: 4000, preferProvider: "gemini" }
    )

    const output = result.text.trim()

    // ── Guardar resultado en DB si se provee ID ───────────────────────────────
    if (transcriptionId) {
      const updateData: Record<string, string> = { updated_at: new Date().toISOString() }

      if (op === "clean")   updateData.transcript_clean = output
      if (op === "summary") updateData.summary          = output
      if (op === "actions") {
        // Guardamos como texto en summary si no hay campo separado
        updateData.summary = (updateData.summary || "") + "\n\n---\n**Tareas:**\n" + output
      }

      await supabase
        .from("audio_transcriptions")
        .update(updateData)
        .eq("id", transcriptionId)
    }

    return NextResponse.json({
      success: true,
      operation: op,
      output,
      model: result.model,
      provider: result.provider,
    })

  } catch (err: any) {
    console.error("transcript-editor error:", err?.message || err)
    return NextResponse.json(
      { error: err?.message || "Error procesando transcripción" },
      { status: 500 }
    )
  }
}
