import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callAI } from "@/lib/ai-router-v4"

export const runtime = "nodejs"
export const maxDuration = 90

type Operation =
  | "clean"
  | "notes"
  | "minutes"
  | "summary"
  | "actions"
  | "chapters"
  | "highlights"
  | "study_guide"
  | "custom"

const SYSTEM_PROMPTS: Record<Operation, string> = {
  clean: `Eres un editor experto de transcripciones. Limpia el texto sin perder contenido.
- Corrige puntuación y ortografía
- Elimina muletillas excesivas
- Conserva etiquetas de hablante
- Mantén el idioma original
Responde solo con el texto limpio.`,

  notes: `Convierte la transcripción en apuntes estructurados en markdown.
Usa títulos, subtítulos, ideas clave, definiciones, ejemplos y conceptos para repasar.`,

  minutes: `Convierte la transcripción en un acta formal de reunión.
Incluye: participantes, temas tratados, decisiones, acuerdos, pendientes y riesgos. Usa markdown.`,

  summary: `Resume la transcripción en 5 a 10 puntos clave.
Usa markdown y prioriza decisiones, ideas centrales y conclusiones.`,

  actions: `Extrae tareas y compromisos de la transcripción.
Usa esta estructura en markdown:
# Tareas
- Tarea
  - Responsable: ...
  - Plazo: ...
  - Evidencia: ...`,

  chapters: `Divide la transcripción en capítulos temáticos.
Usa markdown y para cada capítulo incluye:
## Capítulo X — Título
- inicio estimado
- tema
- resumen breve`,

  highlights: `Extrae citas, frases o ideas destacadas de la transcripción.
Usa markdown con una lista de highlights y breve contexto.`,

  study_guide: `Convierte la transcripción en una guía de estudio.
Incluye:
# Guía de estudio
## Objetivo
## Conceptos clave
## Explicación breve
## Preguntas de repaso
## Mini quiz de 5 preguntas con respuesta.`,

  custom: `Sigue exactamente la instrucción del usuario sobre la transcripción.
Responde solo con el resultado final en markdown si aporta claridad.`,
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  let body: {
    transcriptionId?: string
    transcript?: string
    operation?: Operation
    customInstruction?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const transcript = String(body.transcript || "").trim()
  const operation = (body.operation || "summary") as Operation
  const customInstruction = String(body.customInstruction || "").trim()

  if (!transcript) {
    return NextResponse.json({ error: "Falta transcript" }, { status: 400 })
  }

  if (operation === "custom" && !customInstruction) {
    return NextResponse.json({ error: "Falta customInstruction" }, { status: 400 })
  }

  const system = SYSTEM_PROMPTS[operation]
  const userPrompt = operation === "custom"
    ? `INSTRUCCIÓN DEL USUARIO:\n${customInstruction}\n\nTRANSCRIPCIÓN:\n${transcript}`
    : `TRANSCRIPCIÓN:\n${transcript}`

  try {
    const ai = await callAI(
      [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 4000, preferProvider: "gemini" }
    )

    const output = ai.text.trim()

    if (body.transcriptionId) {
      try {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (operation === "clean") updates.transcript_clean = output
        if (operation === "summary") updates.summary = output
        await supabase.from("audio_transcriptions").update(updates).eq("id", body.transcriptionId)
      } catch {
        // tabla puede no tener todavía todas las columnas
      }
    }

    return NextResponse.json({ success: true, output, provider: ai.provider, model: ai.model })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo procesar la transcripción" }, { status: 500 })
  }
}
