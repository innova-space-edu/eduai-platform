// lib/notebook/ingestion.ts  v3
// - Error checking estricto en cada .update() .delete() .insert()
// - Si falla inserción de chunks → abortar y marcar status=error
// - Logging exacto del error en cada paso
// - pdf-parse compatible CJS/ESM
// - Embeddings en lotes de 4
// - Prefiere raw_text (snapshot) sobre re-fetch de URL

import { createClient } from "@/lib/supabase/server"
import { chunkText, cleanHtml } from "./chunking"
import type { NotebookSource } from "./types"

// ─── Extracción de texto ──────────────────────────────────────────────────────

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
        "User-Agent": "Mozilla/5.0 (compatible; EduAI-NotebookBot/1.0)",
        "Accept":     "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    return cleanHtml(html).slice(0, 50_000)
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

// ─── Embeddings en lotes de 4 ────────────────────────────────────────────────

const EMBEDDING_BATCH = 4

async function generateEmbeddingsBatched(texts: string[]): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = []
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH) {
    const batch        = texts.slice(i, i + EMBEDDING_BATCH)
    const batchResults = await Promise.all(batch.map(generateEmbedding))
    results.push(...batchResults)
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
    const result = await model.embedContent(text.slice(0, 2000))
    return result.embedding.values
  } catch {
    return null
  }
}

// ─── Pipeline principal ───────────────────────────────────────────────────────

export async function ingestNotebookSource(
  sourceId: string,
  rawFileBase64?: string
): Promise<{ ok: boolean; chunkCount: number; error?: string }> {
  const supabase = await createClient()

  // 1. Obtener fuente
  const { data: source, error: srcErr } = await supabase
    .from("notebook_sources")
    .select("*")
    .eq("id", sourceId)
    .single()

  if (srcErr || !source) {
    console.error("[Ingestion] Fuente no encontrada:", srcErr)
    return { ok: false, chunkCount: 0, error: "Fuente no encontrada" }
  }

  // 2. Marcar como procesando
  const { error: statusErr } = await supabase
    .from("notebook_sources")
    .update({ status: "processing" })
    .eq("id", sourceId)

  if (statusErr) {
    console.error("[Ingestion] No se pudo marcar como processing:", statusErr)
  }

  try {
    // 3. Extraer texto
    const text = await extractTextFromSource(source as NotebookSource, rawFileBase64)

    if (!text || text.trim().length < 20) {
      await supabase
        .from("notebook_sources")
        .update({ status: "error", error_message: "No se pudo extraer texto suficiente" })
        .eq("id", sourceId)
      return { ok: false, chunkCount: 0, error: "Texto insuficiente" }
    }

    // 4. Guardar extracted_text — verificar error
    const title = source.title || extractTitleFromText(text, source.url)

    const { error: updErr } = await supabase
      .from("notebook_sources")
      .update({ extracted_text: text.slice(0, 100_000), title, status: "processing" })
      .eq("id", sourceId)

    if (updErr) {
      throw new Error(`No se pudo actualizar la fuente: ${updErr.message}`)
    }

    // 5. Chunking
    const rawChunks = chunkText(text)

    if (rawChunks.length === 0) {
      await supabase
        .from("notebook_sources")
        .update({ status: "error", error_message: "No se generaron chunks del texto" })
        .eq("id", sourceId)
      return { ok: false, chunkCount: 0, error: "No se generaron chunks" }
    }

    // 6. Borrar chunks previos
    const { error: deleteErr } = await supabase
      .from("notebook_chunks")
      .delete()
      .eq("source_id", sourceId)

    if (deleteErr) {
      console.error("[Ingestion] Error borrando chunks previos:", deleteErr)
    }

    // 7. Generar embeddings en lotes
    const chunkTexts = rawChunks.map((c) => c.text)
    const embeddings = await generateEmbeddingsBatched(chunkTexts)

    // 8. Insertar chunks en lotes de 50 — abortar si falla
    const chunkRows = rawChunks.map((c, i) => ({
      notebook_id: source.notebook_id,
      source_id:   sourceId,
      chunk_index: c.index,
      chunk_text:  c.text,
      token_count: c.tokenCount,
      embedding:   embeddings[i] ? `[${embeddings[i]!.join(",")}]` : null,
    }))

    for (let i = 0; i < chunkRows.length; i += 50) {
      const { error: insertErr } = await supabase
        .from("notebook_chunks")
        .insert(chunkRows.slice(i, i + 50))

      if (insertErr) {
        console.error("[Ingestion] chunk insert failed:", insertErr)

        await supabase
          .from("notebook_sources")
          .update({
            status:        "error",
            error_message: `Error insertando chunks: ${insertErr.message}`,
          })
          .eq("id", sourceId)

        return {
          ok:         false,
          chunkCount: 0,
          error:      `Error insertando chunks: ${insertErr.message}`,
        }
      }
    }

    // 9. Marcar ready
    const { error: readyErr } = await supabase
      .from("notebook_sources")
      .update({ status: "ready", title })
      .eq("id", sourceId)

    if (readyErr) {
      console.error("[Ingestion] No se pudo marcar como ready:", readyErr)
    }

    return { ok: true, chunkCount: rawChunks.length }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Ingestion] Pipeline error:", msg)

    await supabase
      .from("notebook_sources")
      .update({ status: "error", error_message: msg })
      .eq("id", sourceId)

    return { ok: false, chunkCount: 0, error: msg }
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function extractTitleFromText(text: string, url?: string | null): string {
  for (const line of text.split("\n").slice(0, 10)) {
    const trimmed = line.replace(/^#+\s*/, "").trim()
    if (trimmed.length > 5 && trimmed.length < 120 && !trimmed.endsWith(".")) {
      return trimmed
    }
  }
  if (url) {
    try {
      const u    = new URL(url)
      const path = u.pathname.replace(/\/$/, "").split("/").pop() ?? ""
      return path
        ? `${u.hostname} — ${decodeURIComponent(path).replace(/-/g, " ")}`
        : u.hostname
    } catch {
      return url.slice(0, 80)
    }
  }
  return "Fuente sin título"
}
