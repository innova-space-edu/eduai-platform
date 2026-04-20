import { createClient } from "@supabase/supabase-js"
import { extractUrlContent } from "@/lib/notebook/extractor"
import { chunkText } from "@/lib/notebook/chunking"

type NotebookSource = {
  id: string
  notebook_id: string
  type: "url" | "pdf" | "docx" | "txt" | "text" | "search_result"
  title?: string | null
  url?: string | null
  raw_text?: string | null
  extracted_text?: string | null
  status?: string | null
  error_message?: string | null
  metadata?: Record<string, unknown> | null
}

type IngestResult = {
  ok: boolean
  chunkCount: number
  error?: string
  title?: string
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(url, serviceRole)
}

async function safeSetSourceError(sourceId: string, message: string) {
  try {
    const supabase = getAdminClient()
    await supabase
      .from("notebook_sources")
      .update({
        status: "error",
        error_message: message,
      })
      .eq("id", sourceId)
  } catch (err) {
    console.error("[Ingestion] No se pudo guardar error_message:", err)
  }
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

async function resolveSourceText(source: NotebookSource, fileBase64?: string): Promise<{
  title?: string
  text: string
  metadata?: Record<string, unknown>
}> {
  if (source.type === "url" || source.type === "search_result") {
    const url = source.url?.trim()
    if (!url) throw new Error("La fuente URL no tiene url asociada")

    const extracted = await extractUrlContent(url)

    return {
      title: extracted.title || source.title || undefined,
      text: extracted.text,
      metadata: {
        ...(source.metadata ?? {}),
        provider: extracted.provider,
        images: extracted.images ?? [],
        url,
      },
    }
  }

  if (source.type === "text") {
    const text = source.raw_text || source.extracted_text || ""
    if (!text.trim()) throw new Error("La fuente de texto está vacía")

    return {
      title: source.title || undefined,
      text,
      metadata: source.metadata ?? {},
    }
  }

  if (source.type === "txt") {
    if (source.raw_text?.trim()) {
      return {
        title: source.title || undefined,
        text: source.raw_text,
        metadata: source.metadata ?? {},
      }
    }

    if (fileBase64) {
      const decoded = Buffer.from(fileBase64, "base64").toString("utf-8")
      if (!decoded.trim()) throw new Error("El archivo TXT está vacío")

      return {
        title: source.title || undefined,
        text: decoded,
        metadata: source.metadata ?? {},
      }
    }

    throw new Error("No hay contenido disponible para la fuente TXT")
  }

  // PDF/DOCX: si ya existe texto extraído, usarlo.
  if (source.extracted_text?.trim()) {
    return {
      title: source.title || undefined,
      text: source.extracted_text,
      metadata: source.metadata ?? {},
    }
  }

  // Fallback simple si se guardó raw_text
  if (source.raw_text?.trim()) {
    return {
      title: source.title || undefined,
      text: source.raw_text,
      metadata: source.metadata ?? {},
    }
  }

  throw new Error(`No hay extractor implementado para el tipo de fuente: ${source.type}`)
}

export async function ingestNotebookSource(
  sourceId: string,
  fileBase64?: string
): Promise<IngestResult> {
  const supabase = getAdminClient()

  try {
    const { data: source, error: sourceErr } = await supabase
      .from("notebook_sources")
      .select("id, notebook_id, type, title, url, raw_text, extracted_text, status, error_message, metadata")
      .eq("id", sourceId)
      .single()

    if (sourceErr || !source) {
      throw new Error(sourceErr?.message || "Fuente no encontrada")
    }

    const typedSource = source as NotebookSource

    const { error: processingErr } = await supabase
      .from("notebook_sources")
      .update({
        status: "processing",
        error_message: null,
      })
      .eq("id", sourceId)

    if (processingErr) {
      throw new Error(`No se pudo marcar la fuente como processing: ${processingErr.message}`)
    }

    const resolved = await resolveSourceText(typedSource, fileBase64)
    const cleanText = normalizeText(resolved.text)

    if (!cleanText || cleanText.length < 50) {
      throw new Error("No se pudo extraer contenido suficiente desde la fuente")
    }

    const chunks = chunkText(cleanText)

    if (!chunks.length) {
      throw new Error("No se generaron chunks válidos para la fuente")
    }

    const { error: deleteErr } = await supabase
      .from("notebook_chunks")
      .delete()
      .eq("source_id", sourceId)

    if (deleteErr) {
      throw new Error(`No se pudieron borrar chunks previos: ${deleteErr.message}`)
    }

    const chunkRows = chunks.map((chunk) => ({
      notebook_id: typedSource.notebook_id,
      source_id: sourceId,
      chunk_index: chunk.index,
      chunk_text: chunk.text,
      token_count: chunk.tokenCount,
      metadata: {
        source_type: typedSource.type,
      },
    }))

    for (let i = 0; i < chunkRows.length; i += 50) {
      const batch = chunkRows.slice(i, i + 50)
      const { error: insertErr } = await supabase
        .from("notebook_chunks")
        .insert(batch)

      if (insertErr) {
        throw new Error(`No se pudieron insertar los chunks: ${insertErr.message}`)
      }
    }

    const { error: readyErr } = await supabase
      .from("notebook_sources")
      .update({
        status: "ready",
        error_message: null,
        title: resolved.title || typedSource.title || null,
        extracted_text: cleanText.slice(0, 100000),
        metadata: resolved.metadata ?? typedSource.metadata ?? {},
      })
      .eq("id", sourceId)

    if (readyErr) {
      throw new Error(`No se pudo marcar la fuente como ready: ${readyErr.message}`)
    }

    return {
      ok: true,
      chunkCount: chunks.length,
      title: resolved.title || typedSource.title || undefined,
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido al ingestar fuente"

    console.error("[Ingestion] Fatal error:", err)
    await safeSetSourceError(sourceId, message)

    return {
      ok: false,
      chunkCount: 0,
      error: message,
    }
  }
}
