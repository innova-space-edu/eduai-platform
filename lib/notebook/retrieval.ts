// lib/notebook/retrieval.ts  v2
// Bug fix: keywordRetrieval filtra solo fuentes activas
// Bug fix: híbrido vectorial + keyword con rerank simple

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

// ─── Retrieval vectorial (pgvector) ──────────────────────────────────────────

async function vectorRetrieval(
  notebookId: string,
  embedding: number[],
  limit: number
): Promise<NotebookChunk[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("match_notebook_chunks", {
    p_notebook_id: notebookId,
    p_embedding:   `[${embedding.join(",")}]`,
    p_limit:       limit,
    p_active_only: true,   // RPC ya filtra fuentes activas via join
  })

  if (error || !data) return []

  return (data as Array<{ id: string; source_id: string; chunk_text: string; score: number }>)
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

// ─── Retrieval por keyword — CORREGIDO: join con notebook_sources ────────────
// Bug fix: antes no filtraba is_active, ahora usa inner join igual que getActiveChunks

async function keywordRetrieval(
  notebookId: string,
  query: string,
  limit: number
): Promise<NotebookChunk[]> {
  const supabase = await createClient()

  // JOIN con notebook_sources para filtrar solo las activas
  const { data, error } = await supabase
    .from("notebook_chunks")
    .select(`
      id, notebook_id, source_id, chunk_index, chunk_text, token_count, created_at,
      notebook_sources!inner(is_active)
    `)
    .eq("notebook_id", notebookId)
    .eq("notebook_sources.is_active", true)   // <-- FIX: solo fuentes activas
    .order("chunk_index")
    .limit(200)

  if (error || !data) return []

  // Tokenizar query: palabras de más de 3 chars, sin stopwords básicas
  const STOPWORDS = new Set(["para", "como", "pero", "desde", "esto", "esta", "sobre"])
  const keywords  = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))

  if (!keywords.length) {
    // Sin keywords: devuelve primeros chunks disponibles
    return (data as NotebookChunk[]).slice(0, limit)
  }

  const scored = (data as (NotebookChunk & { notebook_sources: unknown })[]).map((chunk) => {
    const lower = chunk.chunk_text.toLowerCase()
    let score   = 0
    for (const kw of keywords) {
      const matches = (lower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length
      score += matches
      // Bonus si aparece en los primeros 200 chars (inicio del chunk)
      if (lower.slice(0, 200).includes(kw)) score += 2
    }
    return { ...chunk, score }
  })

  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// ─── Función principal: híbrido vectorial + keyword ──────────────────────────

export async function retrieveRelevantChunks(params: {
  notebookId:      string
  query:           string
  limit?:          number
  activeSourceIds?: string[]
}): Promise<NotebookChunk[]> {
  const { notebookId, query, limit = 6 } = params

  // 1. Intentar vectorial (semántico)
  const embedding = await embedQuery(query)
  if (embedding) {
    const vectorChunks = await vectorRetrieval(notebookId, embedding, limit)
    if (vectorChunks.length >= 3) return vectorChunks

    // Si hay pocos resultados vectoriales, complementar con keyword
    if (vectorChunks.length > 0) {
      const kwChunks    = await keywordRetrieval(notebookId, query, limit)
      const seen        = new Set(vectorChunks.map((c) => c.id))
      const extra       = kwChunks.filter((c) => !seen.has(c.id))
      return [...vectorChunks, ...extra].slice(0, limit)
    }
  }

  // 2. Fallback: solo keyword
  return await keywordRetrieval(notebookId, query, limit)
}

// ─── Chunks de fuentes activas para outputs del Studio ───────────────────────

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

  const result: NotebookChunk[] = []
  let   total  = 0
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
    if (!grouped.has(c.source_id)) grouped.set(c.source_id, [])
    grouped.get(c.source_id)!.push(c.chunk_text)
  }

  const parts: string[] = []
  grouped.forEach((texts, sourceId) => {
    const title = sourceMap.get(sourceId) ?? sourceId
    parts.push(`--- ${title} ---\n${texts.join("\n\n")}`)
  })

  return parts.join("\n\n")
}
