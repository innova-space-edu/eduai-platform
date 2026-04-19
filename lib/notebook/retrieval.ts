// lib/notebook/retrieval.ts
// Recuperación de chunks relevantes (vectorial + fallback keyword)

import { createClient } from "@/lib/supabase/server"
import type { NotebookChunk } from "./types"

// ─── Embedding de query ───────────────────────────────────────────────────────

async function embedQuery(text: string): Promise<number[] | null> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const keys = (process.env.GEMINI_API_KEY_POOL ?? process.env.GEMINI_API_KEY ?? "")
      .split(",").map((k) => k.trim()).filter(Boolean)
    if (!keys.length) return null

    const key    = keys[Math.floor(Math.random() * keys.length)]
    const genai  = new GoogleGenerativeAI(key)
    const model  = genai.getGenerativeModel({ model: "text-embedding-004" })
    const result = await model.embedContent(text.slice(0, 1000))
    return result.embedding.values
  } catch {
    return null
  }
}

// ─── Retrieval vectorial ──────────────────────────────────────────────────────

async function vectorRetrieval(
  notebookId: string,
  embedding: number[],
  limit: number,
  activeSourceIds?: string[]
): Promise<NotebookChunk[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("match_notebook_chunks", {
    p_notebook_id: notebookId,
    p_embedding:   `[${embedding.join(",")}]`,
    p_limit:       limit,
    p_active_only: true,
  })

  if (error || !data) return []

  return (data as Array<{ id: string; source_id: string; chunk_text: string; score: number }>)
    .filter((row) => !activeSourceIds || activeSourceIds.includes(row.source_id))
    .map((row) => ({
      id:          row.id,
      notebook_id: notebookId,
      source_id:   row.source_id,
      chunk_index: 0,
      chunk_text:  row.chunk_text,
      score:       row.score,
      created_at:  "",
    }))
}

// ─── Retrieval por keyword (fallback) ────────────────────────────────────────

async function keywordRetrieval(
  notebookId: string,
  query: string,
  limit: number
): Promise<NotebookChunk[]> {
  const supabase = await createClient()

  // Obtener chunks de fuentes activas
  const { data, error } = await supabase
    .from("notebook_chunks")
    .select("id, notebook_id, source_id, chunk_index, chunk_text, token_count, created_at")
    .eq("notebook_id", notebookId)
    .order("chunk_index")
    .limit(200)

  if (error || !data) return []

  // Filtrar por relevancia simple (presencia de palabras clave)
  const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3)

  const scored = (data as NotebookChunk[]).map((chunk) => {
    const lower = chunk.chunk_text.toLowerCase()
    const score = keywords.reduce((acc, kw) => {
      const matches = (lower.match(new RegExp(kw, "g")) || []).length
      return acc + matches
    }, 0)
    return { ...chunk, score }
  })

  return scored
    .filter((c) => c.score! > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit)
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function retrieveRelevantChunks(params: {
  notebookId: string
  query: string
  limit?: number
  activeSourceIds?: string[]
}): Promise<NotebookChunk[]> {
  const { notebookId, query, limit = 6, activeSourceIds } = params

  // Intentar retrieval vectorial
  const embedding = await embedQuery(query)
  if (embedding) {
    const vectorChunks = await vectorRetrieval(notebookId, embedding, limit, activeSourceIds)
    if (vectorChunks.length > 0) return vectorChunks
  }

  // Fallback a keyword
  return await keywordRetrieval(notebookId, query, limit)
}

// ─── Recuperar chunks de fuentes activas (para generar outputs) ───────────────

export async function getActiveChunks(
  notebookId: string,
  maxChars = 12_000
): Promise<NotebookChunk[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("notebook_chunks")
    .select(`
      id, notebook_id, source_id, chunk_index, chunk_text, token_count, created_at,
      notebook_sources!inner(is_active)
    `)
    .eq("notebook_id", notebookId)
    .eq("notebook_sources.is_active", true)
    .order("source_id")
    .order("chunk_index")
    .limit(150)

  if (!data) return []

  // Limitar caracteres totales
  const result: NotebookChunk[] = []
  let total = 0
  for (const row of data as (NotebookChunk & { notebook_sources: unknown })[]) {
    if (total + row.chunk_text.length > maxChars) break
    result.push(row)
    total += row.chunk_text.length
  }
  return result
}

// ─── Construir contexto textual para prompt ───────────────────────────────────

export function buildContextFromChunks(
  chunks: NotebookChunk[],
  sources: Array<{ id: string; title?: string | null }>
): string {
  const sourceMap = new Map(sources.map((s) => [s.id, s.title ?? "Fuente"]))

  const grouped = new Map<string, string[]>()
  for (const c of chunks) {
    const key = c.source_id
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(c.chunk_text)
  }

  const parts: string[] = []
  grouped.forEach((texts, sourceId) => {
    const title = sourceMap.get(sourceId) ?? sourceId
    parts.push(`--- ${title} ---\n${texts.join("\n\n")}`)
  })

  return parts.join("\n\n")
}
