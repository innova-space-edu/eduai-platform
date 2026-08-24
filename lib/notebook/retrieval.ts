// lib/notebook/retrieval.ts  v4
// Hybrid search: Gemini Embedding 2 + full-text → Reciprocal Rank Fusion.

import { GoogleGenAI } from "@google/genai"
import { createClient } from "@/lib/supabase/server"
import type { NotebookChunk } from "./types"

const EMBEDDING_MODEL = process.env.GOOGLE_EMBEDDING_MODEL || "gemini-embedding-2"
const EMBEDDING_DIMENSIONS = 768

function embeddingKeys(): string[] {
  return (
    process.env.GEMINI_API_KEY_POOL ||
    process.env.GEMINI_API_KEY_TEXT ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  )
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean)
}

async function embedQuery(text: string): Promise<number[] | null> {
  try {
    const keys = embeddingKeys()
    if (!keys.length) return null
    const key = keys[Math.floor(Math.random() * keys.length)]
    const ai = new GoogleGenAI({ apiKey: key })
    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text.slice(0, 8_000),
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    })
    const values = result.embeddings?.[0]?.values
    return Array.isArray(values) && values.length === EMBEDDING_DIMENSIONS ? values : null
  } catch (error) {
    console.warn("[Notebook retrieval][embedding]", error instanceof Error ? error.message : String(error))
    return null
  }
}

async function notebookVectorSpaceIsCurrent(notebookId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("notebook_sources")
    .select("id,ingestion_model")
    .eq("notebook_id", notebookId)
    .eq("is_active", true)
    .eq("status", "ready")

  if (error) {
    // Antes de aplicar la migración de tracking, usar únicamente full-text para no mezclar vectores viejos.
    return false
  }
  if (!data?.length) return false
  return data.every((source) => source.ingestion_model === EMBEDDING_MODEL)
}

async function vectorRetrieval(
  notebookId: string,
  embedding: number[],
  limit: number
): Promise<Array<NotebookChunk & { rank: number }>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("match_notebook_chunks", {
    p_notebook_id: notebookId,
    p_embedding: `[${embedding.join(",")}]`,
    p_limit: limit,
    p_active_only: true,
  })
  if (error || !data) return []
  return (data as Array<{ id: string; source_id: string; chunk_text: string; score: number }>)
    .map((row, index) => ({
      id: row.id,
      notebook_id: notebookId,
      source_id: row.source_id,
      chunk_index: 0,
      chunk_text: row.chunk_text,
      score: row.score,
      rank: index,
      created_at: "",
    }))
}

async function bm25Retrieval(
  notebookId: string,
  query: string,
  limit: number
): Promise<Array<NotebookChunk & { rank: number }>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("search_notebook_chunks_fts", {
    p_notebook_id: notebookId,
    p_query: query,
    p_limit: limit,
    p_active_only: true,
  })

  if (!error && data && data.length > 0) {
    return (data as Array<{ id: string; source_id: string; chunk_text: string; rank: number }>)
      .map((row, index) => ({
        id: row.id,
        notebook_id: notebookId,
        source_id: row.source_id,
        chunk_index: 0,
        chunk_text: row.chunk_text,
        score: row.rank,
        rank: index,
        created_at: "",
      }))
  }

  return keywordFallback(notebookId, query, limit)
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

  const stopwords = new Set(["para","como","pero","desde","esto","esta","sobre","entre","hasta","desde"])
  const keywords = query.toLowerCase().split(/\s+/)
    .filter((word) => word.length > 3 && !stopwords.has(word))

  if (!keywords.length) {
    return (data as NotebookChunk[]).slice(0, limit).map((chunk, index) => ({ ...chunk, rank: index }))
  }

  return (data as (NotebookChunk & { notebook_sources: unknown })[])
    .map((chunk, index) => {
      const lower = chunk.chunk_text.toLowerCase()
      let score = 0
      for (const keyword of keywords) {
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const matches = (lower.match(new RegExp(escaped, "g")) || []).length
        score += matches
        if (lower.slice(0, 200).includes(keyword)) score += 2
      }
      return { ...chunk, score, rank: index }
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function reciprocalRankFusion(
  vectorResults: Array<NotebookChunk & { rank: number }>,
  keywordResults: Array<NotebookChunk & { rank: number }>,
  k = 60,
  topN = 8
): NotebookChunk[] {
  const scores = new Map<string, number>()
  const chunks = new Map<string, NotebookChunk>()

  vectorResults.forEach((chunk, rank) => {
    scores.set(chunk.id, (scores.get(chunk.id) ?? 0) + 1 / (k + rank + 1))
    chunks.set(chunk.id, chunk)
  })
  keywordResults.forEach((chunk, rank) => {
    scores.set(chunk.id, (scores.get(chunk.id) ?? 0) + 1 / (k + rank + 1))
    if (!chunks.has(chunk.id)) chunks.set(chunk.id, chunk)
  })

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([id, score]) => ({ ...chunks.get(id)!, score }))
}

export async function retrieveRelevantChunks(params: {
  notebookId: string
  query: string
  limit?: number
  activeSourceIds?: string[]
}): Promise<NotebookChunk[]> {
  const { notebookId, query, limit = 8 } = params

  // Si el cuaderno contiene embeddings de una generación anterior, no mezclarlos.
  // Full-text sigue operativo y el vector se reactiva después de reingestar las fuentes.
  const vectorReady = await notebookVectorSpaceIsCurrent(notebookId)
  const embedding = vectorReady ? await embedQuery(query) : null

  const [vectorResults, keywordResults] = await Promise.all([
    embedding ? vectorRetrieval(notebookId, embedding, limit * 2) : Promise.resolve([]),
    bm25Retrieval(notebookId, query, limit * 2),
  ])

  if (vectorResults.length === 0 && keywordResults.length === 0) return []
  if (vectorResults.length === 0) return keywordResults.slice(0, limit)
  if (keywordResults.length === 0) return vectorResults.slice(0, limit)
  return reciprocalRankFusion(vectorResults, keywordResults, 60, limit)
}

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
    .order("source_id")
    .order("chunk_index")
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

export function buildContextFromChunks(
  chunks: NotebookChunk[],
  sources: Array<{ id: string; title?: string | null }>
): string {
  const sourceMap = new Map(sources.map((source) => [source.id, source.title ?? "Fuente"]))
  const grouped = new Map<string, string[]>()
  for (const chunk of chunks) {
    if (!grouped.has(chunk.source_id)) grouped.set(chunk.source_id, [])
    grouped.get(chunk.source_id)!.push(chunk.chunk_text)
  }
  const parts: string[] = []
  grouped.forEach((texts, sourceId) => {
    parts.push(`--- ${sourceMap.get(sourceId) ?? sourceId} ---\n${texts.join("\n\n")}`)
  })
  return parts.join("\n\n")
}