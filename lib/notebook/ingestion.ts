import { createClient } from "@/lib/supabase/server"
import { chunkText, cleanHtml } from "./chunking"
import type { NotebookSource } from "./types"

const EMBEDDING_BATCH = 4
const INSERT_BATCH = 50

export async function extractTextFromSource(
  source: NotebookSource,
  rawFileBase64?: string
): Promise<string> {
  switch (source.type) {
    case "text":
    case "search_result":
      return source.raw_text ?? ""

    case "url":
      if (source.raw_text && source.raw_text.trim().length > 100) {
        return source.raw_text
      }
      if (!source.url) return ""
      return extractFromUrl(source.url)

    case "pdf":
      if (rawFileBase64) return extractFromPdfBase64(rawFileBase64)
      return source.raw_text ?? ""

    case "docx":
      if (rawFileBase64) return extractFromDocxBase64(rawFileBase64)
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
        "User-Agent": "Mozilla/5.0 (compatible; EduAI-NotebookBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

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
    const mod = (await import("pdf-parse")) as any
    const pdfParse = (mod.default ?? mod) as (buf: Buffer) => Promise<{ text: string }>
    const buffer = Buffer.from(base64, "base64")
    const data = await pdfParse(buffer)
    return (data.text ?? "").slice(0, 80_000)
  } catch (err) {
    console.error("[Ingestion] PDF parse failed:", err)
    return ""
  }
}

async function extractFromDocxBase64(base64: string): Promise<string> {
  try {
    const mammoth = await import("mammoth")
    const buffer = Buffer.from(base64, "base64")
    const result = await mammoth.extractRawText({ buffer })
    return (result.value ?? "").slice(0, 80_000)
  } catch (err) {
    console.error("[Ingestion] DOCX parse failed:", err)
    return ""
  }
}

async function generateEmbeddingsBatched(texts: string[]): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = []

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH)
    const batchResults = await Promise.all(batch.map(generateEmbedding))
    results.push(...batchResults)
  }

  return results
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const keys = (process.env.GEMINI_API_KEY_POOL ?? process.env.GEMINI_API_KEY ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)

    if (!keys.length) return null

    const key = keys[Math.floor(Math.random() * keys.length)]
    const genai = new GoogleGenerativeAI(key)
    const model = genai.getGenerativeModel({ model: "text-embedding-004" })
    const result = await model.embedContent(text.slice(0, 2000))
    return result.embedding.values ?? null
  } catch (err) {
    console.warn("[Ingestion] Embedding generation failed, continuing without embedding:", err)
    return null
  }
}

async function updateSource(
  sourceId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("notebook_sources").update(patch).eq("id", sourceId)
  if (error) {
    throw new Error(`No se pudo actualizar notebook_sources: ${error.message}`)
  }
}

async function safeSetSourceError(sourceId: string, message: string): Promise<void> {
  const supabase = await createClient()

  const firstTry = await supabase
    .from("notebook_sources")
    .update({ status: "error", error_message: message })
    .eq("id", sourceId)

  if (!firstTry.error) return

  console.warn("[Ingestion] No se pudo guardar error_message, fallback solo status:", firstTry.error)

  const secondTry = await supabase
    .from("notebook_sources")
    .update({ status: "error" })
    .eq("id", sourceId)

  if (secondTry.error) {
    console.error("[Ingestion] Tampoco se pudo guardar status=error:", secondTry.error)
  }
}

function toVectorLiteral(values: number[] | null): string | null {
  if (!values?.length) return null
  return `[${values.join(",")}]`
}

function buildChunkRows(args: {
  notebookId: string
  sourceId: string
  rawChunks: Array<{ index: number; text: string; tokenCount: number }>
  embeddings: (number[] | null)[]
  includeEmbeddings: boolean
}) {
  const { notebookId, sourceId, rawChunks, embeddings, includeEmbeddings } = args

  return rawChunks.map((chunk, i) => ({
    notebook_id: notebookId,
    source_id: sourceId,
    chunk_index: chunk.index,
    chunk_text: chunk.text,
    token_count: chunk.tokenCount,
    embedding: includeEmbeddings ? toVectorLiteral(embeddings[i]) : null,
  }))
}

async function insertChunkRows(
  rows: Array<{
    notebook_id: string
    source_id: string
    chunk_index: number
    chunk_text: string
    token_count: number
    embedding: string | null
  }>
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH)
    const { error } = await supabase.from("notebook_chunks").insert(batch)

    if (error) {
      return { ok: false, error: error.message }
    }
  }

  return { ok: true }
}

export async function ingestNotebookSource(
  sourceId: string,
  rawFileBase64?: string
): Promise<{ ok: boolean; chunkCount: number; error?: string }> {
  const supabase = await createClient()

  const { data: source, error: srcErr } = await supabase
    .from("notebook_sources")
    .select("*")
    .eq("id", sourceId)
    .single()

  if (srcErr || !source) {
    return { ok: false, chunkCount: 0, error: "Fuente no encontrada" }
  }

  try {
    await updateSource(sourceId, { status: "processing" })

    const text = await extractTextFromSource(source as NotebookSource, rawFileBase64)

    if (!text || text.trim().length < 20) {
      await safeSetSourceError(sourceId, "No se pudo extraer texto suficiente")
      return { ok: false, chunkCount: 0, error: "Texto insuficiente" }
    }

    const title = source.title || extractTitleFromText(text, source.url)

    await updateSource(sourceId, {
      extracted_text: text.slice(0, 100_000),
      title,
      status: "processing",
    })

    const rawChunks = chunkText(text)
    if (!rawChunks.length) {
      await safeSetSourceError(sourceId, "No se generaron chunks válidos")
      return { ok: false, chunkCount: 0, error: "No se generaron chunks válidos" }
    }

    const { error: deleteErr } = await supabase
      .from("notebook_chunks")
      .delete()
      .eq("source_id", sourceId)

    if (deleteErr) {
      throw new Error(`No se pudieron borrar chunks previos: ${deleteErr.message}`)
    }

    const chunkTexts = rawChunks.map((c) => c.text)
    const embeddings = await generateEmbeddingsBatched(chunkTexts)

    const rowsWithEmbeddings = buildChunkRows({
      notebookId: source.notebook_id,
      sourceId,
      rawChunks,
      embeddings,
      includeEmbeddings: true,
    })

    let insertResult = await insertChunkRows(rowsWithEmbeddings)

    if (!insertResult.ok) {
      console.warn(
        "[Ingestion] Inserción con embeddings falló. Reintentando sin embeddings:",
        insertResult.error
      )

      const rowsWithoutEmbeddings = buildChunkRows({
        notebookId: source.notebook_id,
        sourceId,
        rawChunks,
        embeddings,
        includeEmbeddings: false,
      })

      insertResult = await insertChunkRows(rowsWithoutEmbeddings)

      if (!insertResult.ok) {
        await safeSetSourceError(
          sourceId,
          `Error insertando chunks: ${insertResult.error ?? "desconocido"}`
        )

        return {
          ok: false,
          chunkCount: 0,
          error: `Error insertando chunks: ${insertResult.error ?? "desconocido"}`,
        }
      }
    }

    await updateSource(sourceId, { status: "ready", title })

    return { ok: true, chunkCount: rawChunks.length }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[Ingestion] ingestNotebookSource failed:", err)
    await safeSetSourceError(sourceId, message)
    return { ok: false, chunkCount: 0, error: message }
  }
}

function extractTitleFromText(text: string, url?: string | null): string {
  for (const line of text.split("\n").slice(0, 10)) {
    const trimmed = line.replace(/^#+\s*/, "").trim()
    if (trimmed.length > 5 && trimmed.length < 120 && !trimmed.endsWith(".")) {
      return trimmed
    }
  }

  if (url) {
    try {
      const u = new URL(url)
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
