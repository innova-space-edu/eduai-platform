// lib/notebook/summarizer.ts  v3
// Usa el agente Redactor para polish del resumen generado

import { createClient }   from "@/lib/supabase/server"
import { callAI }         from "@/lib/ai-router-v4"
import { getActiveChunks, buildContextFromChunks } from "./retrieval"
import { buildSummaryPrompt } from "./prompts"
import type { NotebookSummary } from "./types"

// ─── Generar resumen base + polish con Redactor ───────────────────────────────

export async function generateNotebookSummary(
  notebookId: string,
  specialistRole: string
): Promise<NotebookSummary | null> {
  const supabase = await createClient()

  const chunks = await getActiveChunks(notebookId, 15_000)
  if (chunks.length === 0) return null

  const { data: sources } = await supabase
    .from("notebook_sources")
    .select("id, title")
    .eq("notebook_id", notebookId)
    .eq("is_active", true)

  const contextText = buildContextFromChunks(chunks, sources ?? [])

  // 1. Generar resumen estructurado con Gemini
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
    const raw = response.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    parsed = JSON.parse(raw)
  } catch (err) {
    console.error("[Summarizer] AI/parse failed:", err)
    parsed = {
      summary_markdown: contextText.slice(0, 500) + "...",
      key_points: [], glossary: [], topics: [],
    }
  }

  // 2. Polish del resumen con el agente Redactor (si está disponible)
  //    El Redactor es experto en escritura académica y mejora el estilo
  let polishedSummary = parsed.summary_markdown ?? ""
  if (polishedSummary.length > 100 && process.env.GROQ_API_KEY) {
    try {
      const redactorRes = await callAI(
        [
          {
            role: "system",
            content: `Eres un redactor educativo profesional experto en escritura académica chilena.
Mejora el estilo y claridad del siguiente resumen sin cambiar el contenido ni los datos.
Mantén el formato markdown. Hazlo más claro, fluido y educativo. Máximo 10% más largo.`,
          },
          { role: "user", content: polishedSummary },
        ],
        { maxTokens: 1500, preferProvider: "groq" }
      )
      if (redactorRes.text.length > 100) polishedSummary = redactorRes.text
    } catch {
      // Silently use original if redactor fails
    }
  }

  // 3. Normalizar arrays
  const key_points   = Array.isArray(parsed.key_points)  ? parsed.key_points  : []
  const glossary     = Array.isArray(parsed.glossary)     ? parsed.glossary    : []
  const topics       = Array.isArray(parsed.topics)       ? parsed.topics      : []

  // 4. Upsert en Supabase — guardar como JSONB, no strings
  const { data: existing } = await supabase
    .from("notebook_summaries").select("id").eq("notebook_id", notebookId).single()

  const payload = {
    notebook_id:      notebookId,
    summary_markdown: polishedSummary,
    key_points,
    glossary_json: glossary,
    topics,
    updated_at: new Date().toISOString(),
  }

  let result
  if (existing?.id) {
    const { data } = await supabase.from("notebook_summaries")
      .update(payload).eq("notebook_id", notebookId).select().single()
    result = data
  } else {
    const { data } = await supabase.from("notebook_summaries")
      .insert(payload).select().single()
    result = data
  }

  if (!result) return null

  return {
    id:               result.id,
    notebook_id:      result.notebook_id,
    summary_markdown: result.summary_markdown,
    key_points:       Array.isArray(result.key_points)    ? result.key_points    : [],
    glossary_json:    Array.isArray(result.glossary_json) ? result.glossary_json : [],
    topics:           Array.isArray(result.topics)        ? result.topics        : [],
    updated_at:       result.updated_at,
  }
}
