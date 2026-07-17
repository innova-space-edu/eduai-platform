import { createClient } from "@/lib/supabase/server"
import { chunkText, cleanHtml } from "./chunking"
import { fetchPublicUrl } from "./url-safety"
import type { NotebookSource } from "./types"

const MAX_REMOTE_FILE_BYTES = 20 * 1024 * 1024
const USER_AGENT = "EduAI-Notebook/2.0 (+https://innova-space-edu.cl)"

function normalizeText(value: string, limit = 100_000): string {
  return value
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limit)
}

function extractDoi(value: string): string | null {
  const decoded = decodeURIComponent(value)
  const match = decoded.match(/10\.\d{4,9}\/[\w.()/:;-]+/i)
  return match?.[0]?.replace(/[).,;]+$/, "") || null
}

function extractArxivId(value: string): string | null {
  try {
    const url = new URL(value)
    if (!url.hostname.toLowerCase().endsWith("arxiv.org")) return null
    const match = url.pathname.match(/\/(?:abs|pdf)\/([^/?#]+?)(?:\.pdf)?$/i)
    return match?.[1] || null
  } catch {
    return null
  }
}

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  const mod = (await import("pdf-parse")) as unknown as {
    default?: (value: Buffer) => Promise<{ text?: string }>
  }
  const parser = mod.default ?? (mod as unknown as (value: Buffer) => Promise<{ text?: string }>)
  const result = await parser(buffer)
  return normalizeText(result.text || "", 120_000)
}

async function extractRemotePdf(url: string): Promise<string> {
  const response = await fetchPublicUrl(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/pdf,*/*;q=0.5",
    },
    signal: AbortSignal.timeout(25_000),
  })
  if (!response.ok) throw new Error(`PDF remoto respondió HTTP ${response.status}`)

  const length = Number(response.headers.get("content-length") || 0)
  if (length > MAX_REMOTE_FILE_BYTES) throw new Error("El PDF supera el límite de 20 MB")

  const arrayBuffer = await response.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_REMOTE_FILE_BYTES) throw new Error("El PDF supera el límite de 20 MB")
  return parsePdfBuffer(Buffer.from(arrayBuffer))
}

async function fetchCrossrefMetadata(doi: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=contacto@innova-space-edu.cl`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!response.ok) return ""
    const data = await response.json()
    const work = data?.message
    if (!work) return ""

    const title = Array.isArray(work.title) ? work.title[0] : work.title
    const authors = Array.isArray(work.author)
      ? work.author
          .map((author: { given?: string; family?: string }) => [author.given, author.family].filter(Boolean).join(" "))
          .filter(Boolean)
          .join(", ")
      : ""
    const journal = Array.isArray(work["container-title"]) ? work["container-title"][0] : ""
    const dateParts = work?.published?.["date-parts"]?.[0] || work?.issued?.["date-parts"]?.[0] || []
    const year = dateParts[0] || ""
    const abstract = normalizeText(String(work.abstract || "").replace(/<[^>]+>/g, " "), 20_000)

    return normalizeText([
      title ? `Título: ${title}` : "",
      authors ? `Autores: ${authors}` : "",
      journal ? `Publicación: ${journal}` : "",
      year ? `Año: ${year}` : "",
      `DOI: ${doi}`,
      abstract ? `Resumen del artículo: ${abstract}` : "",
    ].filter(Boolean).join("\n"), 30_000)
  } catch {
    return ""
  }
}

async function extractHtmlDocument(html: string, url: string): Promise<string> {
  try {
    const cheerio = await import("cheerio")
    const $ = cheerio.load(html)
    const title = normalizeText($("title").first().text() || $("h1").first().text(), 300)
    const description = normalizeText(
      $("meta[name='description']").attr("content") || $("meta[property='og:description']").attr("content") || "",
      1_000,
    )

    $(
      [
        "script", "style", "nav", "footer", "header", "aside", "iframe", "noscript", "form", "svg",
        "[class*='cookie']", "[class*='advert']", "[class*='sidebar']", "[class*='navigation']",
        "[id*='cookie']", "[id*='advert']", "[aria-hidden='true']",
      ].join(","),
    ).remove()

    const selectors = [
      "article",
      "main",
      "[role='main']",
      ".article-body",
      ".entry-content",
      ".post-content",
      "#main-content",
      "#content",
    ]
    let root = $("body")
    for (const selector of selectors) {
      const candidate = $(selector).first()
      if (candidate.length && candidate.text().trim().length > 300) {
        root = candidate
        break
      }
    }

    const blocks: string[] = []
    root.find("h1,h2,h3,h4,p,li,blockquote,pre,figcaption").each((_, element) => {
      const tag = element.tagName?.toLowerCase() || ""
      const text = normalizeText($(element).text(), 5_000)
      if (text.length < 2) return
      if (/^h[1-4]$/.test(tag)) blocks.push(`\n## ${text}`)
      else if (tag === "li") blocks.push(`- ${text}`)
      else blocks.push(text)
    })

    const structured = normalizeText([
      title ? `# ${title}` : "",
      description,
      blocks.join("\n\n"),
      `Fuente original: ${url}`,
    ].filter(Boolean).join("\n\n"), 100_000)

    if (structured.length >= 80) return structured
  } catch (error) {
    console.warn("[Notebook ingestion] cheerio fallback:", error)
  }

  return normalizeText(cleanHtml(html), 100_000)
}

async function extractFromUrl(url: string): Promise<string> {
  const arxivId = extractArxivId(url)
  if (arxivId) {
    try {
      const pdfText = await extractRemotePdf(`https://arxiv.org/pdf/${arxivId}.pdf`)
      if (pdfText.length > 100) return pdfText
    } catch (error) {
      console.warn("[Notebook ingestion] arXiv PDF:", error)
    }
  }

  const doi = extractDoi(url)
  const crossrefText = doi ? await fetchCrossrefMetadata(doi) : ""

  const response = await fetchPublicUrl(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.5",
      "Accept-Language": "es-CL,es;q=0.9,en;q=0.7",
    },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    if (crossrefText) return crossrefText
    throw new Error(`El enlace respondió HTTP ${response.status}`)
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase()
  const contentLength = Number(response.headers.get("content-length") || 0)
  if (contentLength > MAX_REMOTE_FILE_BYTES) throw new Error("El recurso supera el límite de 20 MB")

  if (contentType.includes("application/pdf") || new URL(response.url || url).pathname.toLowerCase().endsWith(".pdf")) {
    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_REMOTE_FILE_BYTES) throw new Error("El PDF supera el límite de 20 MB")
    const pdfText = await parsePdfBuffer(Buffer.from(arrayBuffer))
    return normalizeText([crossrefText, pdfText].filter(Boolean).join("\n\n--- TEXTO COMPLETO ---\n\n"), 120_000)
  }

  if (contentType.includes("text/plain")) {
    const text = normalizeText(await response.text(), 100_000)
    return normalizeText([crossrefText, text].filter(Boolean).join("\n\n"), 120_000)
  }

  const html = await response.text()
  const webText = await extractHtmlDocument(html, response.url || url)
  return normalizeText([crossrefText, webText].filter(Boolean).join("\n\n--- CONTENIDO DEL SITIO ---\n\n"), 120_000)
}

export async function extractTextFromSource(
  source: NotebookSource,
  rawFileBase64?: string,
): Promise<string> {
  switch (source.type) {
    case "text":
    case "search_result":
      return source.raw_text ?? ""
    case "url": {
      const extractor = String(source.metadata?.extractor || "")
      if (source.raw_text && source.raw_text.length > 500 && extractor) return source.raw_text
      if (!source.url) return ""
      return extractFromUrl(source.url)
    }
    case "pdf":
      if (rawFileBase64) return parsePdfBuffer(Buffer.from(rawFileBase64, "base64"))
      return source.raw_text ?? ""
    case "docx":
      if (rawFileBase64) {
        const mammoth = await import("mammoth")
        const result = await mammoth.extractRawText({ buffer: Buffer.from(rawFileBase64, "base64") })
        return normalizeText(result.value, 120_000)
      }
      return source.raw_text ?? ""
    case "txt":
      return source.raw_text ?? ""
    default:
      return source.raw_text ?? ""
  }
}

function buildContextualChunkText(chunk: string, sourceTitle: string, documentIntro: string): string {
  const intro = documentIntro.slice(0, 400).replace(/\s+/g, " ").trim()
  return `[Fuente: ${sourceTitle}]\n[Contexto del documento: ${intro}]\n\n${chunk}`
}

const EMBEDDING_BATCH = 4

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const keys = (process.env.GEMINI_API_KEY_POOL ?? process.env.GEMINI_API_KEY ?? "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean)
    if (!keys.length) return null
    const key = keys[Math.floor(Math.random() * keys.length)]
    const client = new GoogleGenerativeAI(key)
    const model = client.getGenerativeModel({ model: "text-embedding-004" })
    const result = await model.embedContent(text.slice(0, 2_048))
    return result.embedding.values
  } catch {
    return null
  }
}

async function generateEmbeddingsBatched(texts: string[]): Promise<Array<number[] | null>> {
  const results: Array<number[] | null> = []
  for (let index = 0; index < texts.length; index += EMBEDDING_BATCH) {
    results.push(...await Promise.all(texts.slice(index, index + EMBEDDING_BATCH).map(generateEmbedding)))
    if (index + EMBEDDING_BATCH < texts.length) await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return results
}

export async function ingestNotebookSource(
  sourceId: string,
  rawFileBase64?: string,
): Promise<{ ok: boolean; chunkCount: number; error?: string }> {
  const supabase = await createClient()
  const { data: source, error: sourceError } = await supabase
    .from("notebook_sources")
    .select("*")
    .eq("id", sourceId)
    .single()

  if (sourceError || !source) return { ok: false, chunkCount: 0, error: "Fuente no encontrada" }
  await supabase.from("notebook_sources").update({ status: "processing", error_message: null }).eq("id", sourceId)

  try {
    const text = normalizeText(await extractTextFromSource(source as NotebookSource, rawFileBase64), 120_000)
    if (text.length < 20) {
      await supabase.from("notebook_sources")
        .update({ status: "error", error_message: "No se pudo extraer texto suficiente" })
        .eq("id", sourceId)
      return { ok: false, chunkCount: 0, error: "Texto insuficiente" }
    }

    const title = source.title || extractTitleFromText(text, source.url)
    const { error: updateError } = await supabase.from("notebook_sources")
      .update({ extracted_text: text, title, status: "processing", error_message: null })
      .eq("id", sourceId)
    if (updateError) throw new Error(updateError.message)

    const rawChunks = chunkText(text)
    if (!rawChunks.length) throw new Error("No se generaron fragmentos de lectura")

    await supabase.from("notebook_chunks").delete().eq("source_id", sourceId)
    const rows = rawChunks.map((chunk) => ({
      notebook_id: source.notebook_id,
      source_id: sourceId,
      chunk_index: chunk.index,
      chunk_text: chunk.text,
      token_count: chunk.tokenCount,
      embedding: null,
    }))

    for (let index = 0; index < rows.length; index += 50) {
      const { error } = await supabase.from("notebook_chunks").insert(rows.slice(index, index + 50))
      if (error) throw new Error(`No se pudieron guardar los fragmentos: ${error.message}`)
    }

    await supabase.from("notebook_sources").update({ status: "ready", title }).eq("id", sourceId)
    return { ok: true, chunkCount: rawChunks.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[Notebook ingestion v2]", message)
    await supabase.from("notebook_sources")
      .update({ status: "error", error_message: message })
      .eq("id", sourceId)
    return { ok: false, chunkCount: 0, error: message }
  }
}

export async function generateEmbeddingsForSource(
  sourceId: string,
): Promise<{ ok: boolean; embedded: number }> {
  const supabase = await createClient()
  const { data: source } = await supabase
    .from("notebook_sources")
    .select("id, title, extracted_text")
    .eq("id", sourceId)
    .single()

  const { data: chunks, error } = await supabase
    .from("notebook_chunks")
    .select("id, chunk_text")
    .eq("source_id", sourceId)
    .is("embedding", null)
    .order("chunk_index")

  if (error || !chunks?.length) return { ok: true, embedded: 0 }

  const sourceTitle = source?.title ?? "Fuente"
  const intro = (source?.extracted_text ?? "").slice(0, 500)
  const embeddings = await generateEmbeddingsBatched(
    chunks.map((chunk) => buildContextualChunkText(chunk.chunk_text, sourceTitle, intro)),
  )

  let embedded = 0
  for (let index = 0; index < chunks.length; index += 1) {
    if (!embeddings[index]) continue
    const { error: updateError } = await supabase.from("notebook_chunks")
      .update({ embedding: `[${embeddings[index]!.join(",")}]` })
      .eq("id", chunks[index].id)
    if (!updateError) embedded += 1
  }
  return { ok: true, embedded }
}

function extractTitleFromText(text: string, url?: string | null): string {
  for (const line of text.split("\n").slice(0, 15)) {
    const value = line.replace(/^#+\s*/, "").replace(/^(Título|Title):\s*/i, "").trim()
    if (value.length > 5 && value.length < 180 && !value.endsWith(".")) return value
  }
  if (url) {
    try {
      const parsed = new URL(url)
      const last = decodeURIComponent(parsed.pathname.replace(/\/$/, "").split("/").pop() || "")
      return last ? last.replace(/[-_]+/g, " ").replace(/\.pdf$/i, "") : parsed.hostname
    } catch {
      return url.slice(0, 160)
    }
  }
  return "Fuente sin título"
}
