import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callAI } from "@/lib/ai-router-v4"
import { buildContextFromChunks, getActiveChunks } from "@/lib/notebook/retrieval"
import { buildPodcastPrompt } from "@/lib/notebook/prompts"

export const maxDuration = 90

type Params = { params: Promise<{ id: string }> }
type AllowedFormat = "cornell" | "podcast"
type PodcastMode = "brief" | "deep" | "critique"

function normalizePodcastSegments(
  segments: Array<{ speaker?: string; text?: string }>,
): Array<{ speaker: "A" | "B"; text: string }> {
  return segments
    .filter((segment) => typeof segment.text === "string" && segment.text.trim().length > 5)
    .map((segment) => ({
      speaker: segment.speaker === "Álvaro" || segment.speaker === "A" ? "A" : "B",
      text: segment.text!.trim(),
    }))
}

function podcastModeInstruction(mode: PodcastMode) {
  if (mode === "brief") {
    return "Crea una conversación breve de 6 a 8 segmentos. Prioriza las ideas centrales y evita detalles secundarios."
  }
  if (mode === "critique") {
    return "Crea una conversación crítica de 10 a 14 segmentos. Distingue evidencia, interpretación, limitaciones, discrepancias y preguntas abiertas."
  }
  return "Crea una conversación profunda de 12 a 16 segmentos. Explica conceptos, relaciones, evidencia y conclusiones con detalle."
}

function buildCornellPrompt({
  specialistRole,
  notebookTitle,
  context,
  topicHint,
}: {
  specialistRole: string
  notebookTitle: string
  context: string
  topicHint?: string
}) {
  return `Eres ${specialistRole}. Crea notas Cornell rigurosas usando exclusivamente las fuentes entregadas.

CUADERNO: ${notebookTitle}
${topicHint ? `ENFOQUE SOLICITADO: ${topicHint}` : ""}

FUENTES:
${context}

REGLAS:
- No agregues información externa ni inventes datos.
- Separa conceptos, preguntas guía, evidencia, explicaciones y síntesis.
- Señala desacuerdos o límites cuando existan.
- Cada fila debe servir para estudiar y volver a las fuentes.

Responde SOLO JSON válido con esta estructura exacta:
{
  "title": "título de las notas",
  "subject": "tema o área",
  "date": "fecha actual o sin fecha",
  "mainNotes": [
    {"topic": "pregunta, palabra clave o concepto", "notes": "apunte claro y respaldado por las fuentes"}
  ],
  "summary": "síntesis final que integra las fuentes sin exceder su evidencia",
  "keywords": ["término 1", "término 2"]
}

Genera entre 6 y 12 filas y entre 5 y 10 palabras clave.`
}

async function verifyNotebook(id: string, userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("notebooks")
    .select("id, title, specialist_role")
    .eq("id", id)
    .eq("user_id", userId)
    .single()
  return data
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    if (!(await verifyNotebook(id, user.id))) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    const formatsParam = new URL(request.url).searchParams.get("formats") || "cornell,podcast"
    const formats = formatsParam.split(",").filter((format): format is AllowedFormat => format === "cornell" || format === "podcast")
    const outputs: Partial<Record<AllowedFormat, Record<string, unknown>>> = {}

    for (const format of formats) {
      const { data } = await supabase
        .from("notebook_outputs")
        .select("output_json, created_at")
        .eq("notebook_id", id)
        .eq("format", format)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data?.output_json && typeof data.output_json === "object") {
        outputs[format] = data.output_json as Record<string, unknown>
      }
    }

    return NextResponse.json({ outputs })
  } catch (error) {
    console.error("[Notebook outputs GET]", error)
    return NextResponse.json({ outputs: {} })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const notebook = await verifyNotebook(id, user.id)
    if (!notebook) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const format = String(body?.format || "") as AllowedFormat
    const topicHint = typeof body?.topicHint === "string" ? body.topicHint.trim().slice(0, 500) : ""
    const podcastMode: PodcastMode = ["brief", "deep", "critique"].includes(body?.podcastMode)
      ? body.podcastMode
      : "deep"

    if (format !== "cornell" && format !== "podcast") {
      return NextResponse.json(
        { error: "En el cuaderno solo están disponibles Notas Cornell y Podcast." },
        { status: 400 },
      )
    }

    const { data: sourceData } = await supabase
      .from("notebook_sources")
      .select("id, title")
      .eq("notebook_id", id)
      .eq("is_active", true)
      .eq("status", "ready")
    const sources = sourceData || []
    if (!sources.length) {
      return NextResponse.json({ error: "No hay fuentes activas procesadas." }, { status: 422 })
    }

    const chunks = await getActiveChunks(id, format === "podcast" ? 16_000 : 14_000)
    if (!chunks.length) {
      return NextResponse.json({ error: "No hay texto procesado suficiente en las fuentes." }, { status: 422 })
    }
    const context = buildContextFromChunks(chunks, sources)

    let prompt: string
    if (format === "cornell") {
      prompt = buildCornellPrompt({
        specialistRole: notebook.specialist_role,
        notebookTitle: notebook.title,
        context,
        topicHint,
      })
    } else {
      prompt = `${buildPodcastPrompt({
        summary: context.slice(0, 12_000),
        keyPoints: [],
        specialistRole: notebook.specialist_role,
      })}

MODO DEL EPISODIO: ${podcastMode}
${podcastModeInstruction(podcastMode)}
${topicHint ? `ENFOQUE SOLICITADO: ${topicHint}` : ""}

REGLAS ADICIONALES:
- Usa exclusivamente las fuentes del cuaderno.
- Si las fuentes discrepan, haz que los locutores lo expliquen.
- No inventes cifras, autores, fechas ni conclusiones.
- El cierre debe distinguir qué está respaldado y qué queda abierto.`
    }

    let output: Record<string, unknown>
    try {
      const response = await callAI(
        [{ role: "user", content: prompt }],
        { maxTokens: 4_000, preferProvider: "gemini" },
      )
      const raw = response.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      output = JSON.parse(raw) as Record<string, unknown>
    } catch (error) {
      console.error("[Notebook generate parse]", error)
      return NextResponse.json({ error: "La IA no devolvió un formato válido. Intenta nuevamente." }, { status: 500 })
    }

    if (format === "podcast") {
      const rawSegments = Array.isArray(output.segments)
        ? output.segments as Array<{ speaker?: string; text?: string }>
        : []
      output._podcastWavSegments = normalizePodcastSegments(rawSegments)
      output._audioEndpoint = "/api/agents/podcast-wav"
      output._podcastMode = podcastMode
    }
    output._sourceCount = sources.length
    output._generatedFromNotebook = true

    const { data: saved, error: saveError } = await supabase
      .from("notebook_outputs")
      .insert({
        notebook_id: id,
        format,
        title: typeof output.title === "string" ? output.title : notebook.title,
        output_json: output,
        version: 1,
      })
      .select("id")
      .single()

    if (saveError) console.warn("[Notebook generate save]", saveError.message)
    return NextResponse.json({ ok: true, output, savedId: saved?.id || null, format })
  } catch (error) {
    console.error("[Notebook generate POST]", error)
    return NextResponse.json({ error: "Error interno al generar" }, { status: 500 })
  }
}
