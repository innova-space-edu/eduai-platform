// lib/notebook/summarizer.ts
// Genera el resumen base del notebook desde las fuentes activas

import { createClient }   from "@/lib/supabase/server"
import { callAI }         from "@/lib/ai-router-v4"
import { getActiveChunks, buildContextFromChunks } from "./retrieval"
import { buildSummaryPrompt } from "./prompts"
import type { NotebookSummary } from "./types"

export async function generateNotebookSummary(
  notebookId: string,
  specialistRole: string
): Promise<NotebookSummary | null> {
  const supabase = await createClient()

  // 1. Obtener chunks y fuentes activas
  const chunks = await getActiveChunks(notebookId, 15_000)
  if (chunks.length === 0) return null

  const { data: sources } = await supabase
    .from("notebook_sources")
    .select("id, title")
    .eq("notebook_id", notebookId)
    .eq("is_active", true)

  const contextText = buildContextFromChunks(chunks, sources ?? [])

  // 2. Llamar al AI
  const prompt = buildSummaryPrompt(contextText, specialistRole)
  let parsed: {
    summary_markdown: string
    key_points: string[]
    glossary: Array<{ term: string; definition: string }>
    topics: string[]
  }

  try {
    const response = await callAI(
      [{ role: "user", content: prompt }],
      { maxTokens: 3000, preferProvider: "gemini" }
    )

    const raw = response.text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim()

    parsed = JSON.parse(raw)
  } catch (err) {
    console.error("[Summarizer] AI/parse failed:", err)
    // Fallback básico
    parsed = {
      summary_markdown: contextText.slice(0, 500) + "...",
      key_points: [],
      glossary: [],
      topics: [],
    }
  }

  // 3. Upsert en Supabase
  const { data: existing } = await supabase
    .from("notebook_summaries")
    .select("id")
    .eq("notebook_id", notebookId)
    .single()

  const summaryData = {
    notebook_id:      notebookId,
    summary_markdown: parsed.summary_markdown ?? "",
    key_points:       JSON.stringify(parsed.key_points ?? []),
    glossary_json:    JSON.stringify(parsed.glossary ?? []),
    topics:           JSON.stringify(parsed.topics ?? []),
    updated_at:       new Date().toISOString(),
  }

  let result
  if (existing?.id) {
    const { data } = await supabase
      .from("notebook_summaries")
      .update(summaryData)
      .eq("notebook_id", notebookId)
      .select()
      .single()
    result = data
  } else {
    const { data } = await supabase
      .from("notebook_summaries")
      .insert(summaryData)
      .select()
      .single()
    result = data
  }

  if (!result) return null

  return {
    id:               result.id,
    notebook_id:      result.notebook_id,
    summary_markdown: result.summary_markdown,
    key_points:       typeof result.key_points === "string"
      ? JSON.parse(result.key_points)
      : result.key_points ?? [],
    glossary_json:    typeof result.glossary_json === "string"
      ? JSON.parse(result.glossary_json)
      : result.glossary_json ?? [],
    topics:           typeof result.topics === "string"
      ? JSON.parse(result.topics)
      : result.topics ?? [],
    updated_at:       result.updated_at,
  }
}
