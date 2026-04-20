// lib/notebook/retrieval.ts  v3
// Hybrid search: vector (pgvector) + BM25 full-text (pg_trgm) → Reciprocal Rank Fusion
// RRF mejora retrieval ~26-31% vs vector-only (arXiv:2402.03367)

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
): Promise<Array<NotebookChunk & { rank: number }>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("match_notebook_chunks", {
    p_notebook_id: notebookId,
    p_embedding:   `[${embedding.join(",")}]`,
    p_limit:       limit,
    p_active_only: true,
  })
  if (error || !data) return []
  return (data as Array<{ id: string; source_id: string; chunk_text: string; score: number }>)
    .map((row, i) => ({
      id: row.id, notebook_id: notebookId, source_id: row.source_id,
      chunk_index: 0, chunk_text: row.chunk_text,
      score: row.score, rank: i, created_at: "",
    }))
}

// ─── Retrieval full-text BM25 (PostgreSQL ts_rank_cd) ────────────────────────

async function bm25Retrieval(
  notebookId: string,
  query: string,
  limit: number
): Promise<Array<NotebookChunk & { rank: number }>> {
  const supabase = await createClient()

  // Intentar RPC con BM25 real (requiere migration_bm25.sql)
  const { data, error } = await supabase.rpc("search_notebook_chunks_fts", {
    p_notebook_id: notebookId,
    p_query:       query,
    p_limit:       limit,
    p_active_only: true,
  })

  if (!error && data && data.length > 0) {
    return (data as Array<{ id: string; source_id: string; chunk_text: string; rank: number }>)
      .map((row, i) => ({
        id: row.id, notebook_id: notebookId, source_id: row.source_id,
        chunk_index: 0, chunk_text: row.chunk_text,
        score: row.rank, rank: i, created_at: "",
      }))
  }

  // Fallback: keyword scoring en memoria si BM25 RPC no está disponible
  return await keywordFallback(notebookId, query, limit)
}

async function keywordFallback(
  notebookId: string,
  query: string,
  limit: number
): Promise<Array<NotebookChunk & { rank: number }>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("notebook_chunks")
    .select(`id, notebook_id, source_id, chunk_index, chunk_text, token_count, created_at,
      notebook_sources!inner(is_active)`)
    .eq("notebook_id", notebookId)
    .eq("notebook_sources.is_active", true)
    .order("chunk_index")
    .limit(200)

  if (!data) return []

  const STOPWORDS = new Set(["para","como","pero","desde","esto","esta","sobre","entre","hasta","desde"])
  const keywords  = query.toLowerCase().split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))

  if (!keywords.length) return (data as NotebookChunk[]).slice(0, limit).map((c, i) => ({ ...c, rank: i }))

  return (data as (NotebookChunk & { notebook_sources: unknown })[])
    .map((chunk, i) => {
      const lower  = chunk.chunk_text.toLowerCase()
      let   score  = 0
      for (const kw of keywords) {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const matches = (lower.match(new RegExp(escaped, "g")) || []).length
        score += matches
        if (lower.slice(0, 200).includes(kw)) score += 2
      }
      return { ...chunk, score, rank: i }
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// ─── Reciprocal Rank Fusion ───────────────────────────────────────────────────
// Parámetro k=60 es el estándar de la literatura (Cormack et al., 2009)

function reciprocalRankFusion(
  vectorResults:  Array<NotebookChunk & { rank: number }>,
  keywordResults: Array<NotebookChunk & { rank: number }>,
  k = 60,
  topN = 8
): NotebookChunk[] {
  const scores = new Map<string, number>()
  const chunks  = new Map<string, NotebookChunk>()

  vectorResults.forEach((c, rank) => {
    scores.set(c.id, (scores.get(c.id) ?? 0) + 1 / (k + rank + 1))
    chunks.set(c.id, c)
  })
  keywordResults.forEach((c, rank) => {
    scores.set(c.id, (scores.get(c.id) ?? 0) + 1 / (k + rank + 1))
    if (!chunks.has(c.id)) chunks.set(c.id, c)
  })

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([id, score]) => ({ ...chunks.get(id)!, score }))
}

// ─── Retrieval principal: hybrid RRF ─────────────────────────────────────────

export async function retrieveRelevantChunks(params: {
  notebookId:      string
  query:           string
  limit?:          number
  activeSourceIds?: string[]
}): Promise<NotebookChunk[]> {
  const { notebookId, query, limit = 8 } = params

  // Lanzar vector y BM25 en paralelo
  const embedding = await embedQuery(query)

  const [vectorResults, keywordResults] = await Promise.all([
    embedding ? vectorRetrieval(notebookId, embedding, limit * 2) : Promise.resolve([]),
    bm25Retrieval(notebookId, query, limit * 2),
  ])

  // Si solo tenemos uno de los dos, usar ese directamente
  if (vectorResults.length === 0 && keywordResults.length === 0) return []
  if (vectorResults.length === 0) return keywordResults.slice(0, limit)
  if (keywordResults.length === 0) return vectorResults.slice(0, limit)

  // Hybrid RRF
  return reciprocalRankFusion(vectorResults, keywordResults, 60, limit)
}

// ─── Chunks activos para Studio ──────────────────────────────────────────────

export async function getActiveChunks(
  notebookId: string,
  maxChars = 12_000
): Promise<NotebookChunk[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("notebook_chunks")
    .select(`id, notebook_id, source_id, chunk_index, chunk_text, token_count, created_at,
      notebook_sources!inner(is_active)`)
    .eq("notebook_id", notebookId)
    .eq("notebook_sources.is_active", true)
    .order("source_id").order("chunk_index")
    .limit(150)

  if (!data) return []
  const result: NotebookChunk[] = []
  let total = 0
  for (const row of data as (NotebookChunk & { notebook_sources: unknown })[]) {
    if (total + row.chunk_text.length > maxChars) break
    result.push(row)
    total += row.chunk_text.length
  }
  return result
}

// ─── Contexto textual para prompts ───────────────────────────────────────────

export function buildContextFromChunks(
  chunks: NotebookChunk[],
  sources: Array<{ id: string; title?: string | null }>
): string {
  const sourceMap = new Map(sources.map((s) => [s.id, s.title ?? "Fuente"]))
  const grouped   = new Map<string, string[]>()
  for (const c of chunks) {
    if (!grouped.has(c.source_id)) grouped.set(c.source_id, [])
    grouped.get(c.source_id)!.push(c.chunk_text)
  }
  const parts: string[] = []
  grouped.forEach((texts, sourceId) => {
    parts.push(`--- ${sourceMap.get(sourceId) ?? sourceId} ---\n${texts.join("\n\n")}`)
  })
  return parts.join("\n\n")
}
