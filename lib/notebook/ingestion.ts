// lib/notebook/ingestion.ts  v5
// Mejoras:
// - Contextual RAG: enriquece cada chunk con título+resumen del documento antes de embeddear
//   (Anthropic Contextual Retrieval: ~49% mejora en retrieval)
// - Fase 1: extrae texto + chunking + guarda → ready en ~5-10s
// - Fase 2 (background): genera embeddings con contexto enriquecido

import { createClient } from "@/lib/supabase/server"
import { chunkText, cleanHtml } from "./chunking"
import type { NotebookSource } from "./types"

// ─── Extracción ──────────────────────────────────────────────────────────────

export async function extractTextFromSource(
  source: NotebookSource,
  rawFileBase64?: string
): Promise<string> {
  switch (source.type) {
    case "text":
    case "search_result":
      return source.raw_text ?? ""
    case "url":
      if (source.raw_text && source.raw_text.length > 100) return source.raw_text
      if (!source.url) return ""
      return await extractFromUrl(source.url)
    case "pdf":
      if (rawFileBase64) return await extractFromPdfBase64(rawFileBase64)
      if (source.raw_text) return source.raw_text
      return ""
    case "docx":
      if (rawFileBase64) return await extractFromDocxBase64(rawFileBase64)
      if (source.raw_text) return source.raw_text
      return ""
    case "txt":
      return source.raw_text ?? ""
    default:
      return source.raw_text ?? ""
  }
}

async function extractFromUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept":     "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    return cleanHtml(html).slice(0, 40_000)
  } catch (err) {
    console.error("[Ingestion] URL fetch failed:", err)
    return ""
  }
}

async function extractFromPdfBase64(base64: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod      = (await import("pdf-parse")) as any
    const pdfParse = (mod.default ?? mod) as (buf: Buffer) => Promise<{ text: string }>
    const buffer   = Buffer.from(base64, "base64")
    const data     = await pdfParse(buffer)
    return data.text.slice(0, 80_000)
  } catch (err) {
    console.error("[Ingestion] PDF parse failed:", err)
    return ""
  }
}

async function extractFromDocxBase64(base64: string): Promise<string> {
  try {
    const mammoth = await import("mammoth")
    const buffer  = Buffer.from(base64, "base64")
    const result  = await mammoth.extractRawText({ buffer })
    return result.value.slice(0, 80_000)
  } catch (err) {
    console.error("[Ingestion] DOCX parse failed:", err)
    return ""
  }
}

// ─── Contextual enrichment ────────────────────────────────────────────────────
// Prepend document context to each chunk text before embedding
// Técnica: Anthropic Contextual Retrieval (mejora retrieval ~49%)
// No requiere LLM — usa el título y primeros 300 chars del documento

function buildContextualChunkText(
  chunkText:     string,
  sourceTitle:   string,
  documentIntro: string
): string {
  const intro = documentIntro.slice(0, 300).replace(/\s+/g, " ").trim()
  return `[Fuente: ${sourceTitle}]\n[Contexto del documento: ${intro}]\n\n${chunkText}`
}

// ─── Embeddings en lotes ─────────────────────────────────────────────────────

const EMBEDDING_BATCH = 4

async function generateEmbeddingsBatched(
  texts: string[]
): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = []
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH) {
    const batch        = texts.slice(i, i + EMBEDDING_BATCH)
    const batchResults = await Promise.all(batch.map(generateEmbedding))
    results.push(...batchResults)
    if (i + EMBEDDING_BATCH < texts.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  return results
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const keys = (process.env.GEMINI_API_KEY_POOL ?? process.env.GEMINI_API_KEY ?? "")
      .split(",").map((k) => k.trim()).filter(Boolean)
    if (!keys.length) return null
    const key    = keys[Math.floor(Math.random() * keys.length)]
    const genai  = new GoogleGenerativeAI(key)
    const model  = genai.getGenerativeModel({ model: "text-embedding-004" })
    const result = await model.embedContent(text.slice(0, 2048))
    return result.embedding.values
  } catch {
    return null
  }
}

// ─── FASE 1: Ingestión rápida — sin embeddings ───────────────────────────────

export async function ingestNotebookSource(
  sourceId: string,
  rawFileBase64?: string
): Promise<{ ok: boolean; chunkCount: number; error?: string }> {
  const supabase = await createClient()

  const { data: source, error: srcErr } = await supabase
    .from("notebook_sources").select("*").eq("id", sourceId).single()

  if (srcErr || !source) {
    return { ok: false, chunkCount: 0, error: "Fuente no encontrada" }
  }

  await supabase.from("notebook_sources").update({ status: "processing" }).eq("id", sourceId)

  try {
    const text = await extractTextFromSource(source as NotebookSource, rawFileBase64)

    if (!text || text.trim().length < 20) {
      await supabase.from("notebook_sources")
        .update({ status: "error", error_message: "No se pudo extraer texto suficiente" })
        .eq("id", sourceId)
      return { ok: false, chunkCount: 0, error: "Texto insuficiente" }
    }

    const title = source.title || extractTitleFromText(text, source.url)

    const { error: updErr } = await supabase.from("notebook_sources")
      .update({ extracted_text: text.slice(0, 100_000), title, status: "processing" })
      .eq("id", sourceId)

    if (updErr) throw new Error(`No se pudo actualizar la fuente: ${updErr.message}`)

    const rawChunks = chunkText(text)
    if (rawChunks.length === 0) {
      await supabase.from("notebook_sources")
        .update({ status: "error", error_message: "No se generaron chunks" })
        .eq("id", sourceId)
      return { ok: false, chunkCount: 0, error: "No se generaron chunks" }
    }

    await supabase.from("notebook_chunks").delete().eq("source_id", sourceId)

    // Insertar chunks sin embeddings (rápido)
    const chunkRows = rawChunks.map((c) => ({
      notebook_id: source.notebook_id,
      source_id:   sourceId,
      chunk_index: c.index,
      chunk_text:  c.text,
      token_count: c.tokenCount,
      embedding:   null,
    }))

    for (let i = 0; i < chunkRows.length; i += 50) {
      const { error: insertErr } = await supabase
        .from("notebook_chunks").insert(chunkRows.slice(i, i + 50))
      if (insertErr) {
        await supabase.from("notebook_sources")
          .update({ status: "error", error_message: `Error insertando chunks: ${insertErr.message}` })
          .eq("id", sourceId)
        return { ok: false, chunkCount: 0, error: `Error insertando chunks: ${insertErr.message}` }
      }
    }

    await supabase.from("notebook_sources").update({ status: "ready", title }).eq("id", sourceId)
    return { ok: true, chunkCount: rawChunks.length }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Ingestion] Pipeline error:", msg)
    await supabase.from("notebook_sources")
      .update({ status: "error", error_message: msg }).eq("id", sourceId)
    return { ok: false, chunkCount: 0, error: msg }
  }
}

// ─── FASE 2: Embeddings con contextual enrichment ────────────────────────────
// Llamada en background tras ingestión. Usa título + intro del doc como contexto.

export async function generateEmbeddingsForSource(
  sourceId: string
): Promise<{ ok: boolean; embedded: number }> {
  const supabase = await createClient()

  // Obtener fuente para título y texto de intro
  const { data: source } = await supabase
    .from("notebook_sources")
    .select("id, title, extracted_text")
    .eq("id", sourceId)
    .single()

  const sourceTitle = source?.title ?? "Fuente"
  const docIntro    = (source?.extracted_text ?? "").slice(0, 400)

  // Chunks sin embedding
  const { data: chunks, error } = await supabase
    .from("notebook_chunks")
    .select("id, chunk_text")
    .eq("source_id", sourceId)
    .is("embedding", null)
    .order("chunk_index")

  if (error || !chunks || chunks.length === 0) return { ok: true, embedded: 0 }

  // Enriquecer cada chunk con contexto del documento (Contextual RAG)
  const enrichedTexts = chunks.map((c) =>
    buildContextualChunkText(c.chunk_text, sourceTitle, docIntro)
  )

  const embeddings = await generateEmbeddingsBatched(enrichedTexts)

  let embedded = 0
  for (let i = 0; i < chunks.length; i++) {
    if (!embeddings[i]) continue
    const { error: e } = await supabase.from("notebook_chunks")
      .update({ embedding: `[${embeddings[i]!.join(",")}]` })
      .eq("id", chunks[i].id)
    if (!e) embedded++
  }

  return { ok: true, embedded }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function extractTitleFromText(text: string, url?: string | null): string {
  for (const line of text.split("\n").slice(0, 10)) {
    const trimmed = line.replace(/^#+\s*/, "").trim()
    if (trimmed.length > 5 && trimmed.length < 120 && !trimmed.endsWith(".")) return trimmed
  }
  if (url) {
    try {
      const u    = new URL(url)
      const path = u.pathname.replace(/\/$/, "").split("/").pop() ?? ""
      return path ? `${u.hostname} — ${decodeURIComponent(path).replace(/-/g, " ")}` : u.hostname
    } catch { return url.slice(0, 80) }
  }
  return "Fuente sin título"
}
