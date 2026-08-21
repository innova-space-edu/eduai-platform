// lib/notebook/summarizer.ts
// Resumen persistente + reutilización exacta mediante EduAI AI Gateway.

import { createClient } from "@/lib/supabase/server"
import { runAIText } from "@/lib/ai/gateway"
import { getActiveChunks, buildContextFromChunks } from "./retrieval"
import { buildSummaryPrompt } from "./prompts"
import type { NotebookSummary } from "./types"

export async function generateNotebookSummary(
  notebookId: string,
  specialistRole: string
): Promise<NotebookSummary | null> {
  const supabase = await createClient()

  const { data: notebook } = await supabase
    .from("notebooks")
    .select("id,user_id")
    .eq("id", notebookId)
    .single()
  if (!notebook?.user_id) return null

  const chunks = await getActiveChunks(notebookId, 15_000)
  if (chunks.length === 0) return null

  const { data: sources } = await supabase
    .from("notebook_sources")
    .select("id, title")
    .eq("notebook_id", notebookId)
    .eq("is_active", true)

  const contextText = buildContextFromChunks(chunks, sources ?? [])
  const aiContext = {
    userId: notebook.user_id as string,
    module: "notebook-summary",
    sourceId: notebookId,
    reusePolicy: "exact_private" as const,
    visibility: "private" as const,
  }

  const prompt = buildSummaryPrompt(contextText, specialistRole)
  let parsed: {
    summary_markdown: string
    key_points: string[]
    glossary: Array<{ term: string; definition: string }>
    topics: string[]
  }

  try {
    const response = await runAIText({
      messages: [{ role: "user", content: prompt }],
      capability: "long_context",
      maxOutputTokens: 3000,
      context: aiContext,
      supabase,
    })
    const raw = response.data.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    parsed = JSON.parse(raw)
  } catch (err) {
    console.error("[Summarizer] AI/parse failed:", err)
    parsed = {
      summary_markdown: contextText.slice(0, 500) + "...",
      key_points: [],
      glossary: [],
      topics: [],
    }
  }

  let polishedSummary = parsed.summary_markdown ?? ""
  if (polishedSummary.length > 100 && process.env.GROQ_API_KEY) {
    try {
      const redactorRes = await runAIText({
        messages: [
          {
            role: "system",
            content: `Eres un redactor educativo profesional experto en escritura académica chilena.
Mejora el estilo y claridad del siguiente resumen sin cambiar el contenido ni los datos.
Mantén el formato markdown. Hazlo más claro, fluido y educativo. Máximo 10% más largo.`,
          },
          { role: "user", content: polishedSummary },
        ],
        capability: "text",
        maxOutputTokens: 1500,
        preferredProvider: "groq",
        context: { ...aiContext, module: "notebook-summary-polish" },
        supabase,
      })
      if (redactorRes.data.length > 100) polishedSummary = redactorRes.data
    } catch {
      // Mantener resumen original si el pulido no está disponible.
    }
  }

  const key_points = Array.isArray(parsed.key_points) ? parsed.key_points : []
  const glossary = Array.isArray(parsed.glossary) ? parsed.glossary : []
  const topics = Array.isArray(parsed.topics) ? parsed.topics : []

  const { data: existing } = await supabase
    .from("notebook_summaries")
    .select("id")
    .eq("notebook_id", notebookId)
    .single()

  const payload = {
    notebook_id: notebookId,
    summary_markdown: polishedSummary,
    key_points,
    glossary_json: glossary,
    topics,
    updated_at: new Date().toISOString(),
  }

  let result
  if (existing?.id) {
    const { data } = await supabase
      .from("notebook_summaries")
      .update(payload)
      .eq("notebook_id", notebookId)
      .select()
      .single()
    result = data
  } else {
    const { data } = await supabase
      .from("notebook_summaries")
      .insert(payload)
      .select()
      .single()
    result = data
  }

  if (!result) return null

  return {
    id: result.id,
    notebook_id: result.notebook_id,
    summary_markdown: result.summary_markdown,
    key_points: Array.isArray(result.key_points) ? result.key_points : [],
    glossary_json: Array.isArray(result.glossary_json) ? result.glossary_json : [],
    topics: Array.isArray(result.topics) ? result.topics : [],
    updated_at: result.updated_at,
  }
}
