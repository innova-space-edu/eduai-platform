// lib/notebook/summarizer.ts  v2
// Bug fix: guardar JSONB como objetos reales, no como strings serializados

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

  // 1. Chunks + fuentes activas
  const chunks = await getActiveChunks(notebookId, 15_000)
  if (chunks.length === 0) return null

  const { data: sources } = await supabase
    .from("notebook_sources")
    .select("id, title")
    .eq("notebook_id", notebookId)
    .eq("is_active", true)

  const contextText = buildContextFromChunks(chunks, sources ?? [])

  // 2. Llamar AI
  const prompt = buildSummaryPrompt(contextText, specialistRole)
  let parsed: {
    summary_markdown: string
    key_points:       string[]
    glossary:         Array<{ term: string; definition: string }>
    topics:           string[]
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
    parsed = {
      summary_markdown: `Resumen generado desde ${chunks.length} fragmentos.`,
      key_points:       [],
      glossary:         [],
      topics:           [],
    }
  }

  // 3. Normalizar arrays por si la IA devuelve algo raro
  const key_points   = Array.isArray(parsed.key_points)  ? parsed.key_points  : []
  const glossary     = Array.isArray(parsed.glossary)     ? parsed.glossary    : []
  const topics       = Array.isArray(parsed.topics)       ? parsed.topics      : []

  // 4. Upsert — BUG FIX: guardar como objetos JSONB, NO como JSON.stringify
  const { data: existing } = await supabase
    .from("notebook_summaries")
    .select("id")
    .eq("notebook_id", notebookId)
    .single()

  const payload = {
    notebook_id:      notebookId,
    summary_markdown: parsed.summary_markdown ?? "",
    key_points,         // ← array directo, no string
    glossary_json:  glossary,  // ← objeto directo, no string
    topics,             // ← array directo, no string
    updated_at:       new Date().toISOString(),
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

  // 5. Devolver tipado — sin parseo extra porque ya guardamos como JSONB
  return {
    id:               result.id,
    notebook_id:      result.notebook_id,
    summary_markdown: result.summary_markdown,
    key_points:       Array.isArray(result.key_points)   ? result.key_points   : [],
    glossary_json:    Array.isArray(result.glossary_json) ? result.glossary_json : [],
    topics:           Array.isArray(result.topics)        ? result.topics        : [],
    updated_at:       result.updated_at,
  }
}
