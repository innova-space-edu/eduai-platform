// lib/notebook/ingestion.ts
// Pipeline de ingestión de fuentes: extracción → chunking → embeddings

import { createClient } from "@/lib/supabase/server"
import { chunkText, cleanHtml } from "./chunking"
import type { NotebookSource } from "./types"

// ─── Extracción de texto según tipo ─────────────────────────────────────────

export async function extractTextFromSource(
  source: NotebookSource,
  rawFileBase64?: string
): Promise<string> {
  switch (source.type) {
    case "text":
    case "search_result":
      return source.raw_text ?? ""

    case "url":
      if (!source.url) return ""
      return await extractFromUrl(source.url)

    case "pdf":
      if (rawFileBase64) return await extractFromPdfBase64(rawFileBase64)
      if (source.file_path) return `[PDF: ${source.title ?? source.file_path}]`
      return source.raw_text ?? ""

    case "docx":
      if (rawFileBase64) return await extractFromDocxBase64(rawFileBase64)
      return source.raw_text ?? ""

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
        "User-Agent":
          "Mozilla/5.0 (compatible; EduAI-NotebookBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
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
    const pdfParse = (await import("pdf-parse")).default
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

// ─── Embeddings ──────────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const keys = (process.env.GEMINI_API_KEY_POOL ?? process.env.GEMINI_API_KEY ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)

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
    return { ok: false, chunkCount: 0, error: "Fuente no encontrada" }
  }

  // 2. Marcar como procesando
  await supabase
    .from("notebook_sources")
    .update({ status: "processing" })
    .eq("id", sourceId)

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

    // 4. Guardar texto extraído
    const title = source.title || extractTitleFromText(text, source.url)
    await supabase
      .from("notebook_sources")
      .update({
        extracted_text: text.slice(0, 100_000),
        title,
        status: "processing",
      })
      .eq("id", sourceId)

    // 5. Chunking
    const rawChunks = chunkText(text)

    // 6. Borrar chunks anteriores si reingesta
    await supabase
      .from("notebook_chunks")
      .delete()
      .eq("source_id", sourceId)

    // 7. Insertar chunks (con embeddings si están disponibles)
    const chunkRows = await Promise.all(
      rawChunks.map(async (c) => {
        const embedding = await generateEmbedding(c.text)
        return {
          notebook_id: source.notebook_id,
          source_id:   sourceId,
          chunk_index: c.index,
          chunk_text:  c.text,
          token_count: c.tokenCount,
          embedding:   embedding ? `[${embedding.join(",")}]` : null,
        }
      })
    )

    // Insertar en batches de 50
    for (let i = 0; i < chunkRows.length; i += 50) {
      const batch = chunkRows.slice(i, i + 50)
      await supabase.from("notebook_chunks").insert(batch)
    }

    // 8. Marcar como lista
    await supabase
      .from("notebook_sources")
      .update({ status: "ready", title })
      .eq("id", sourceId)

    return { ok: true, chunkCount: rawChunks.length }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase
      .from("notebook_sources")
      .update({ status: "error", error_message: msg })
      .eq("id", sourceId)
    return { ok: false, chunkCount: 0, error: msg }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractTitleFromText(text: string, url?: string | null): string {
  // Intentar primera línea no vacía
  const firstLine = text.split("\n").find((l) => l.trim().length > 5)?.trim()
  if (firstLine && firstLine.length < 120) return firstLine

  if (url) {
    try {
      const u = new URL(url)
      return u.hostname + u.pathname.replace(/\//g, " ").trim()
    } catch {
      return url.slice(0, 80)
    }
  }

  return "Fuente sin título"
}
