// app/api/notebooks/[id]/generate/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient }   from "@/lib/supabase/server"
import { callAI }         from "@/lib/ai-router-v4"
import { getActiveChunks, buildContextFromChunks } from "@/lib/notebook/retrieval"
import {
  buildInfographicPrompt,
  buildMindmapPrompt,
  buildQuizPrompt,
  buildPodcastPrompt,
  buildFlashcardsPrompt,
  buildTimelinePrompt,
} from "@/lib/notebook/prompts"
import type { NotebookOutputFormat } from "@/lib/notebook/types"

export const maxDuration = 90

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data: nb } = await supabase
    .from("notebooks")
    .select("id, title, specialist_role")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()
  if (!nb) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const { format, topicHint } = body as { format: NotebookOutputFormat; topicHint?: string }

  const VALID_FORMATS: NotebookOutputFormat[] = [
    "infographic", "mindmap", "quiz", "podcast", "flashcards", "timeline",
    "presentation", "cornell", "glossary", "story", "lessonplan",
  ]
  if (!VALID_FORMATS.includes(format)) {
    return NextResponse.json({ error: `formato inválido: ${format}` }, { status: 400 })
  }

  // 1. Obtener resumen existente
  const { data: summaryRow } = await supabase
    .from("notebook_summaries")
    .select("*")
    .eq("notebook_id", id)
    .single()

  const summary    = summaryRow?.summary_markdown ?? ""
  const keyPoints: string[] = typeof summaryRow?.key_points === "string"
    ? JSON.parse(summaryRow.key_points)
    : summaryRow?.key_points ?? []

  // 2. Obtener chunks si el formato necesita detalle
  const detailFormats: NotebookOutputFormat[] = ["quiz", "flashcards", "timeline", "podcast"]
  let contextChunks = ""

  if (detailFormats.includes(format) || !summary) {
    const { data: sources } = await supabase
      .from("notebook_sources")
      .select("id, title")
      .eq("notebook_id", id)
      .eq("is_active", true)

    const chunks = await getActiveChunks(id, 12_000)
    contextChunks = buildContextFromChunks(chunks, sources ?? [])
  }

  // 3. Construir prompt según formato
  let prompt = ""
  switch (format) {
    case "infographic":
      prompt = buildInfographicPrompt({
        summary: summary || contextChunks.slice(0, 4000),
        keyPoints,
        specialistRole: nb.specialist_role,
        topicHint,
      })
      break
    case "mindmap":
      prompt = buildMindmapPrompt({
        summary: summary || contextChunks.slice(0, 4000),
        keyPoints,
        specialistRole: nb.specialist_role,
      })
      break
    case "quiz":
      prompt = buildQuizPrompt({
        chunks: contextChunks || summary,
        specialistRole: nb.specialist_role,
      })
      break
    case "podcast":
      prompt = buildPodcastPrompt({
        summary: summary || contextChunks.slice(0, 4000),
        keyPoints,
        specialistRole: nb.specialist_role,
      })
      break
    case "flashcards":
      prompt = buildFlashcardsPrompt({
        chunks: contextChunks || summary,
        specialistRole: nb.specialist_role,
      })
      break
    case "timeline":
      prompt = buildTimelinePrompt({
        chunks: contextChunks || summary,
        specialistRole: nb.specialist_role,
      })
      break
    default:
      // Para formatos no implementados aún, usar proceso genérico
      prompt = `Eres ${nb.specialist_role}. Basándote en este contenido, genera un ${format} educativo en JSON.

CONTENIDO:
${summary || contextChunks.slice(0, 5000)}

Responde SOLO en JSON bien estructurado para un ${format} educativo.`
  }

  // 4. Llamar a AI
  let outputJson: Record<string, unknown>
  try {
    const response = await callAI(
      [{ role: "user", content: prompt }],
      { maxTokens: 4000, preferProvider: "gemini" }
    )
    const raw = response.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    outputJson = JSON.parse(raw)
  } catch (err) {
    console.error("[Generate] AI/parse failed:", err)
    return NextResponse.json({ error: "Error generando contenido" }, { status: 500 })
  }

  // 5. Guardar output en Supabase
  const { data: saved, error: saveErr } = await supabase
    .from("notebook_outputs")
    .insert({
      notebook_id: id,
      format,
      title:       (outputJson.title as string) ?? nb.title,
      output_json: outputJson,
      version:     1,
    })
    .select()
    .single()

  if (saveErr) {
    console.error("[Generate] Save failed:", saveErr)
  }

  return NextResponse.json({
    ok:     true,
    output: outputJson,
    savedId: saved?.id ?? null,
    format,
  })
}
