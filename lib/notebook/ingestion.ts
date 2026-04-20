// lib/notebook/ingestion.ts  v4
// OPTIMIZACIÓN: ingestión en 2 fases
// Fase 1 (ingestNotebookSource): extrae texto + chunks, marca ready en ~3-8s
// Fase 2 (generateEmbeddingsForSource): genera embeddings en background sin bloquear UI
// Si no hay embeddings, retrieval cae a keyword (funciona igual)

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

// ─── Embedding ───────────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const keys = (process.env.GEMINI_API_KEY_POOL ?? process.env.GEMINI_API_KEY ?? "")
      .split(",").map((k) => k.trim()).filter(Boolean)
    if (!keys.length) return null
    const key    = keys[Math.floor(Math.random() * keys.length)]
    const genai  = new GoogleGenerativeAI(key)
    const model  = genai.getGenerativeModel({ model: "text-embedding-004" })
    const result = await model.embedContent(text.slice(0, 2000))
    return result.embedding.values
  } catch {
    return null
  }
}

// ─── FASE 1: ingestión rápida — sin embeddings ───────────────────────────────
// Objetivo: < 10s por fuente
// Extrae texto → chunks → guarda sin embeddings → marca ready

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
    // Extraer texto
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

    // Insertar chunks SIN embeddings — rápido
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

    // Marcar READY sin esperar embeddings
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

// ─── FASE 2: generar embeddings en background ────────────────────────────────
// Llamada asíncrona DESPUÉS de que la UI muestra ready
// Si falla, keyword retrieval sigue funcionando

export async function generateEmbeddingsForSource(
  sourceId: string
): Promise<{ ok: boolean; embedded: number }> {
  const supabase = await createClient()

  const { data: chunks, error } = await supabase
    .from("notebook_chunks")
    .select("id, chunk_text")
    .eq("source_id", sourceId)
    .is("embedding", null)
    .order("chunk_index")

  if (error || !chunks || chunks.length === 0) return { ok: true, embedded: 0 }

  let embedded = 0
  const BATCH  = 4

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(async (c) => ({ id: c.id, embedding: await generateEmbedding(c.chunk_text) }))
    )
    for (const r of results) {
      if (!r.embedding) continue
      await supabase.from("notebook_chunks")
        .update({ embedding: `[${r.embedding.join(",")}]` }).eq("id", r.id)
      embedded++
    }
    if (i + BATCH < chunks.length) await new Promise((res) => setTimeout(res, 300))
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
