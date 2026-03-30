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

type RequestBody = {
  transcriptionId?: string
  transcript?: string
  operation?: Operation | string
  customInstruction?: string
}

const VALID_OPERATIONS: Operation[] = [
  "clean",
  "notes",
  "minutes",
  "summary",
  "actions",
  "chapters",
  "highlights",
  "study_guide",
  "custom",
]

const SYSTEM_PROMPTS: Record<Operation, string> = {
  clean: `Eres un editor experto de transcripciones. Limpia el texto sin perder contenido.
- Corrige puntuación y ortografía
- Elimina muletillas excesivas
- Conserva etiquetas de hablante
- Mantén el idioma original
- No inventes información
Responde solo con el texto limpio.`,

  notes: `Convierte la transcripción en apuntes estructurados en markdown.
Usa títulos, subtítulos, ideas clave, definiciones, ejemplos y conceptos para repasar.
No inventes contenido que no aparezca en la transcripción.`,

  minutes: `Convierte la transcripción en un acta formal de reunión.
Incluye: participantes, temas tratados, decisiones, acuerdos, pendientes y riesgos.
Usa markdown.
Si algún dato no está claro, indica "No especificado".`,

  summary: `Resume la transcripción en 5 a 10 puntos clave.
Usa markdown y prioriza decisiones, ideas centrales y conclusiones.
No inventes contenido.`,

  actions: `Extrae tareas y compromisos de la transcripción.
Usa esta estructura en markdown:

# Tareas
- Tarea
  - Responsable: ...
  - Plazo: ...
  - Evidencia: ...

Si algún dato no aparece, escribe "No especificado".`,

  chapters: `Divide la transcripción en capítulos temáticos.
Usa markdown y para cada capítulo incluye:

## Capítulo X — Título
- inicio estimado
- tema
- resumen breve

No inventes temas ajenos a la transcripción.`,

  highlights: `Extrae citas, frases o ideas destacadas de la transcripción.
Usa markdown con una lista de highlights y breve contexto.
No repitas contenido innecesariamente.`,

  study_guide: `Convierte la transcripción en una guía de estudio.
Incluye:

# Guía de estudio
## Objetivo
## Conceptos clave
## Explicación breve
## Preguntas de repaso
## Mini quiz de 5 preguntas con respuesta

No inventes información fuera de la transcripción.`,

  custom: `Sigue exactamente la instrucción del usuario sobre la transcripción.
Responde solo con el resultado final en markdown si aporta claridad.
No inventes información.`,
}

function isValidOperation(value: string): value is Operation {
  return VALID_OPERATIONS.includes(value as Operation)
}

function normalizeTranscript(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
}

function truncateTranscript(text: string, maxChars = 120000): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n\n[TRANSCRIPCIÓN RECORTADA POR LONGITUD]`
}

function buildUserPrompt(
  operation: Operation,
  transcript: string,
  customInstruction: string
): string {
  if (operation === "custom") {
    return `INSTRUCCIÓN DEL USUARIO:
${customInstruction}

TRANSCRIPCIÓN:
${transcript}`
  }

  return `TRANSCRIPCIÓN:
${transcript}`
}

async function persistOutputs(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  transcriptionId: string
  operation: Operation
  output: string
}) {
  const { supabase, transcriptionId, operation, output } = params

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (operation === "clean") updates.transcript_clean = output
  if (operation === "summary") updates.summary = output
  if (operation === "notes") updates.notes = output
  if (operation === "minutes") updates.minutes = output
  if (operation === "actions") updates.actions = output
  if (operation === "chapters") updates.chapters = output
  if (operation === "highlights") updates.highlights = output
  if (operation === "study_guide") updates.study_guide = output

  if (Object.keys(updates).length <= 1) return

  try {
    await supabase.from("audio_transcriptions").update(updates).eq("id", transcriptionId)
  } catch {
    // La tabla puede no tener aún todas estas columnas.
    // No rompemos el flujo por persistencia parcial.
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  let body: RequestBody

  try {
    body = (await req.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const rawTranscript = String(body.transcript || "")
  const transcript = truncateTranscript(normalizeTranscript(rawTranscript))
  const rawOperation = String(body.operation || "summary").trim()
  const customInstruction = String(body.customInstruction || "").trim()

  if (!transcript) {
    return NextResponse.json({ error: "Falta transcript" }, { status: 400 })
  }

  if (!isValidOperation(rawOperation)) {
    return NextResponse.json(
      {
        error: "Operación inválida",
        validOperations: VALID_OPERATIONS,
      },
      { status: 400 }
    )
  }

  const operation: Operation = rawOperation

  if (operation === "custom" && !customInstruction) {
    return NextResponse.json(
      { error: "Falta customInstruction para la operación custom" },
      { status: 400 }
    )
  }

  const system = SYSTEM_PROMPTS[operation]
  const userPrompt = buildUserPrompt(operation, transcript, customInstruction)

  try {
    const ai = await callAI(
      [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      {
        maxTokens: 4000,
        preferProvider: "gemini",
      }
    )

    const output = String(ai.text || "").trim()

    if (!output) {
      return NextResponse.json(
        { error: "La IA no devolvió contenido" },
        { status: 502 }
      )
    }

    if (body.transcriptionId) {
      await persistOutputs({
        supabase,
        transcriptionId: body.transcriptionId,
        operation,
        output,
      })
    }

    return NextResponse.json({
      success: true,
      operation,
      output,
      provider: ai.provider,
      model: ai.model,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo procesar la transcripción"

    return NextResponse.json(
      {
        error: message,
        success: false,
      },
      { status: 500 }
    )
  }
}
