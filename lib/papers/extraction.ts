import { createHash } from "node:crypto"
import { parseDocumentWithExternalService } from "@/lib/papers/parser-client"

export const STORAGE_BUCKET = "papers"
export const MAX_PDF_SIZE_MB = 50
export const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024
export const MAX_GEMINI_INLINE_PDF_MB = 10
export const MAX_GEMINI_INLINE_PDF_BYTES = MAX_GEMINI_INLINE_PDF_MB * 1024 * 1024
export const MAX_RETURN_TEXT_CHARS = 180_000

const MAX_SUMMARY_SOURCE_CHARS = 12_000
const CHUNK_TARGET_CHARS = 1800
const CHUNK_MIN_CHARS = 450
const CHUNK_MAX_CHARS = 2400

type SupabaseClientLike = any

export interface PaperChunkRow {
  document_id: string
  user_id: string
  chunk_index: number
  section_title: string | null
  page_start: number
  page_end: number
  content: string
  lexical_hint: string
}

export interface PaperDocumentRow {
  id?: string
  user_id: string
  bucket: string
  file_path: string
  title: string
  raw_text: string
  summary: string
  page_count: number
  extraction_method: string
  parser_used: string
  ocr_used: boolean
  source_file_size_bytes?: number | null
  source_file_sha256?: string | null
  metadata?: Record<string, any>
}

export interface PaperExtractionResult {
  title: string
  text: string
  summary: string
  pageCount: number
  extractionMethod: string
  parserUsed: string
  ocrUsed: boolean
  truncated: boolean
  fromCache: boolean
  bucket: string
  filePath: string
  documentId?: string
  chunks?: PaperChunkRow[]
  error?: boolean
}

interface PageText {
  pageNumber: number
  text: string
}

interface ExtractorResult {
  text: string
  pageCount: number
  pages: PageText[]
  summary?: string
  success: boolean
  usedOCR?: boolean
  method: string
}

function getString(value: unknown) {
  return typeof value === "string" ? value : ""
}

export function cleanText(text: string) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00A0]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function truncateText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + "\n\n[Texto truncado por límite interno]"
}

function hasUsefulExtractedText(text: string) {
  const clean = cleanText(text)
  if (!clean) return false
  if (clean.length >= 700) return true
  return clean.split(/\s+/).filter(Boolean).length >= 120
}

export function deriveTitle(filename?: string, filePath?: string) {
  const cleanFilename = getString(filename).trim()
  if (cleanFilename) return cleanFilename.replace(/\.pdf$/i, "") || "Documento"

  const cleanPath = getString(filePath).trim()
  if (!cleanPath) return "Documento"

  const parts = cleanPath.split("/")
  const lastPart = decodeURIComponent(parts[parts.length - 1] || "documento.pdf")
    .replace(/^\d+-/, "")
    .replace(/^[a-f0-9-]{20,}-/i, "")

  return lastPart.replace(/\.pdf$/i, "") || "Documento"
}

function parseGeminiJson(raw: string) {
  let data: any = null

  try {
    data = JSON.parse(raw)
  } catch {}

  if (!data) {
    const md = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (md) {
      try {
        data = JSON.parse(md[1].trim())
      } catch {}
    }
  }

  if (!data) {
    const obj = raw.match(/\{[\s\S]*\}/)
    if (obj) {
      try {
        data = JSON.parse(obj[0])
      } catch {}
    }
  }

  return data
}

function normalizeForLexical(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s\-.:/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function looksLikeHeading(line: string) {
  const s = line.trim()
  if (!s) return false
  if (s.length > 110) return false
  if (/^(abstract|summary|resumen|introduction|introducci[oó]n|method|methodology|metodolog[ií]a|results|resultados|discussion|discusi[oó]n|conclusion|conclusiones|references|referencias)\b/i.test(s)) {
    return true
  }
  if (/^\d+(\.\d+)*\s+[A-ZÁÉÍÓÚÑ]/.test(s)) return true
  if (/^[A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\s\-:,()]{4,}$/.test(s)) return true
  return false
}

function buildPagesFromRawText(text: string) {
  const raw = String(text || "")
  if (!raw.trim()) return []

  const splitByFormFeed = raw.split(/\f/g).map(t => cleanText(t)).filter(Boolean)
  if (splitByFormFeed.length > 1) {
    return splitByFormFeed.map((pageText, index) => ({
      pageNumber: index + 1,
      text: pageText,
    }))
  }

  return [{ pageNumber: 1, text: cleanText(raw) }]
}

function buildChunksFromPages(pages: PageText[]) {
  const chunks: Array<{
    sectionTitle: string | null
    pageStart: number
    pageEnd: number
    content: string
    lexicalHint: string
  }> = []

  let currentSection: string | null = null
  let currentText = ""
  let currentPageStart = pages[0]?.pageNumber || 1
  let currentPageEnd = pages[0]?.pageNumber || 1

  const flush = () => {
    const content = cleanText(currentText)
    if (!content || content.length < CHUNK_MIN_CHARS) return

    chunks.push({
      sectionTitle: currentSection,
      pageStart: currentPageStart,
      pageEnd: currentPageEnd,
      content,
      lexicalHint: normalizeForLexical(`${currentSection || ""} ${content.slice(0, 300)}`),
    })

    currentText = ""
  }

  for (const page of pages) {
    const paragraphs = page.text
      .split(/\n\s*\n/g)
      .map(p => cleanText(p))
      .filter(Boolean)

    for (const paragraph of paragraphs) {
      const lines = paragraph.split("\n").map(l => l.trim()).filter(Boolean)
      const firstLine = lines[0] || ""

      if (looksLikeHeading(firstLine) && paragraph.length <= 180) {
        flush()
        currentSection = firstLine
        currentPageStart = page.pageNumber
        currentPageEnd = page.pageNumber
        continue
      }

      const candidate = currentText ? `${currentText}\n\n${paragraph}` : paragraph

      if (!currentText) {
        currentPageStart = page.pageNumber
        currentPageEnd = page.pageNumber
      }

      if (candidate.length <= CHUNK_TARGET_CHARS) {
        currentText = candidate
        currentPageEnd = page.pageNumber
        continue
      }

      if (currentText) {
        flush()
      }

      if (paragraph.length <= CHUNK_MAX_CHARS) {
        currentText = paragraph
        currentPageStart = page.pageNumber
        currentPageEnd = page.pageNumber
        continue
      }

      let remaining = paragraph
      while (remaining.length > CHUNK_MAX_CHARS) {
        const slice = remaining.slice(0, CHUNK_TARGET_CHARS)
        const lastBreak = Math.max(
          slice.lastIndexOf(". "),
          slice.lastIndexOf("\n"),
          slice.lastIndexOf("; "),
          slice.lastIndexOf(", ")
        )
        const cut = lastBreak > CHUNK_MIN_CHARS ? lastBreak + 1 : CHUNK_TARGET_CHARS
        const part = cleanText(remaining.slice(0, cut))
        if (part) {
          chunks.push({
            sectionTitle: currentSection,
            pageStart: page.pageNumber,
            pageEnd: page.pageNumber,
            content: part,
            lexicalHint: normalizeForLexical(`${currentSection || ""} ${part.slice(0, 300)}`),
          })
        }
        remaining = cleanText(remaining.slice(cut))
      }

      currentText = remaining
      currentPageStart = page.pageNumber
      currentPageEnd = page.pageNumber
    }
  }

  flush()

  if (!chunks.length && pages.length) {
    const fallbackText = cleanText(pages.map(p => p.text).join("\n\n"))
    if (fallbackText) {
      chunks.push({
        sectionTitle: null,
        pageStart: 1,
        pageEnd: pages.length,
        content: fallbackText,
        lexicalHint: normalizeForLexical(fallbackText.slice(0, 600)),
      })
    }
  }

  return chunks
}

async function extractTextWithPdfParse(buffer: Buffer): Promise<ExtractorResult> {
  try {
    const pdfParseModule: any = await import("pdf-parse")
    const pdfParse = pdfParseModule.default || pdfParseModule.pdf || pdfParseModule
    const parsed = await pdfParse(buffer)

    const rawText = String(parsed?.text || "")
    const pages = buildPagesFromRawText(rawText)
    const text = cleanText(pages.map(p => p.text).join("\n\n"))

    return {
      text,
      pageCount: parsed?.numpages || pages.length || 0,
      pages,
      success: hasUsefulExtractedText(text),
      method: "pdf-parse",
    }
  } catch (error) {
    console.error("[Paper] pdf-parse failed:", error)
    return {
      text: "",
      pageCount: 0,
      pages: [],
      success: false,
      method: "pdf-parse",
    }
  }
}

async function extractTextWithOCR(buffer: Buffer, filename: string): Promise<ExtractorResult> {
  if (!process.env.OCR_SPACE_API_KEY) {
    return {
      text: "",
      pageCount: 0,
      pages: [],
      success: false,
      usedOCR: false,
      method: "ocr-space",
    }
  }

  try {
    const formData = new FormData()
    formData.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
      filename || "documento.pdf"
    )
    formData.append("isOverlayRequired", "false")
    formData.append("OCREngine", "2")
    formData.append("detectOrientation", "true")
    formData.append("scale", "true")
    formData.append("language", "spa")

    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: process.env.OCR_SPACE_API_KEY },
      body: formData,
    })

    const data: any = await res.json().catch(() => null)

    if (!res.ok || !data || data.IsErroredOnProcessing) {
      console.error("[Paper] OCR error:", data?.ErrorMessage || data?.ErrorDetails)
      return {
        text: "",
        pageCount: 0,
        pages: [],
        success: false,
        usedOCR: true,
        method: "ocr-space",
      }
    }

    const pages: PageText[] = (data.ParsedResults || [])
      .map((r: any, index: number) => ({
        pageNumber: index + 1,
        text: cleanText(r?.ParsedText || ""),
      }))
      .filter((p: PageText) => !!p.text)

    const text = cleanText(pages.map(p => p.text).join("\n\n"))

    return {
      text,
      pageCount: pages.length,
      pages,
      success: hasUsefulExtractedText(text),
      usedOCR: true,
      method: "ocr-space",
    }
  } catch (error) {
    console.error("[Paper] OCR failed:", error)
    return {
      text: "",
      pageCount: 0,
      pages: [],
      success: false,
      usedOCR: true,
      method: "ocr-space",
    }
  }
}

async function extractTextWithGemini(base64: string, title: string): Promise<ExtractorResult> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      text: "",
      pageCount: 0,
      pages: [],
      success: false,
      method: "gemini-inline",
    }
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" })

    const result = await model.generateContent([
      { inlineData: { mimeType: "application/pdf", data: base64 } },
      {
        text:
          `Extrae TODO el texto del PDF preservando estructura y secciones.\n` +
          `Luego devuelve JSON válido, sin markdown:\n` +
          `{"title":"...","text":"...","summary":"..."}\n` +
          `Mantén el idioma original. Si no puedes identificar el título usa "${title}".`,
      },
    ])

    const raw = result.response.text().trim()
    const data = parseGeminiJson(raw)
    const text = cleanText(getString(data?.text))
    const summary = cleanText(getString(data?.summary))
    const pages = buildPagesFromRawText(text)

    return {
      text,
      summary,
      pageCount: pages.length,
      pages,
      success: hasUsefulExtractedText(text),
      method: "gemini-inline",
    }
  } catch (error) {
    console.error("[Paper] Gemini inline failed:", error)
    return {
      text: "",
      pageCount: 0,
      pages: [],
      success: false,
      method: "gemini-inline",
    }
  }
}

async function summarizeWithGemini(title: string, text: string) {
  if (!process.env.GEMINI_API_KEY || !text.trim()) return ""

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" })

    const prompt =
      `Resume este documento en 4 frases en el mismo idioma del documento.\n` +
      `Incluye: tema central, método o enfoque, hallazgo principal y conclusión.\n\n` +
      `TÍTULO: ${title}\n\n` +
      `TEXTO:\n${text.slice(0, MAX_SUMMARY_SOURCE_CHARS)}`

    const result = await model.generateContent(prompt)
    return cleanText(result.response.text())
  } catch (error) {
    console.error("[Paper] summary failed:", error)
    return ""
  }
}

async function getPaperDocument(
  supabase: SupabaseClientLike,
  userId: string,
  bucket: string,
  filePath: string
) {
  try {
    const { data, error } = await supabase
      .from("paper_documents")
      .select("*")
      .eq("user_id", userId)
      .eq("bucket", bucket)
      .eq("file_path", filePath)
      .maybeSingle()

    if (error) {
      console.error("[Paper] getPaperDocument:", error)
      return null
    }

    return data ?? null
  } catch {
    return null
  }
}

async function getPaperChunks(
  supabase: SupabaseClientLike,
  documentId: string
) {
  try {
    const { data, error } = await supabase
      .from("paper_chunks")
      .select("*")
      .eq("document_id", documentId)
      .order("chunk_index", { ascending: true })

    if (error) {
      console.error("[Paper] getPaperChunks:", error)
      return []
    }

    return data ?? []
  } catch {
    return []
  }
}

async function upsertPaperDocument(
  supabase: SupabaseClientLike,
  row: PaperDocumentRow
) {
  const { data, error } = await supabase
    .from("paper_documents")
    .upsert(row, { onConflict: "user_id,bucket,file_path" })
    .select("id")
    .single()

  if (error) throw error
  return data?.id as string
}

async function replacePaperChunks(
  supabase: SupabaseClientLike,
  documentId: string,
  rows: PaperChunkRow[]
) {
  const { error: delError } = await supabase
    .from("paper_chunks")
    .delete()
    .eq("document_id", documentId)

  if (delError) throw delError

  if (!rows.length) return

  const { error } = await supabase
    .from("paper_chunks")
    .insert(rows)

  if (error) throw error
}

async function syncLegacyExtractionCache(
  supabase: SupabaseClientLike,
  params: {
    userId: string
    bucket: string
    filePath: string
    title: string
    text: string
    summary: string
    pageCount: number
    extractionMethod: string
    fileSize?: number
    sha256?: string
  }
) {
  try {
    await supabase.from("paper_extractions").upsert(
      {
        user_id: params.userId,
        bucket: params.bucket,
        file_path: params.filePath,
        title: params.title,
        extracted_text: params.text,
        summary: params.summary,
        page_count: params.pageCount,
        extraction_method: params.extractionMethod,
        truncated: false,
        source_file_size_bytes: params.fileSize ?? null,
        source_file_sha256: params.sha256 ?? null,
        error_message: null,
      },
      { onConflict: "user_id,bucket,file_path" }
    )
  } catch {
    // opcional
  }
}

export async function ensurePaperProcessed(params: {
  supabase: SupabaseClientLike
  userId: string
  bucket: string
  filePath: string
  filename?: string
  forceRefresh?: boolean
}): Promise<PaperExtractionResult> {
  const {
    supabase,
    userId,
    bucket,
    filePath,
    filename = "",
    forceRefresh = false,
  } = params

  const title = deriveTitle(filename, filePath)

  if (!forceRefresh) {
    const cachedDoc = await getPaperDocument(supabase, userId, bucket, filePath)
    if (cachedDoc?.raw_text?.trim()) {
      const chunks = cachedDoc.id ? await getPaperChunks(supabase, cachedDoc.id) : []

      return {
        title: cachedDoc.title || title,
        text: cachedDoc.raw_text,
        summary: cachedDoc.summary || "",
        pageCount: cachedDoc.page_count || 0,
        extractionMethod: cachedDoc.extraction_method || "cache",
        parserUsed: cachedDoc.parser_used || "internal-v2",
        ocrUsed: !!cachedDoc.ocr_used,
        truncated: false,
        fromCache: true,
        bucket,
        filePath,
        documentId: cachedDoc.id,
        chunks,
      }
    }
  }

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(bucket)
    .download(filePath)

  if (downloadError || !fileBlob) {
    throw new Error("No se pudo descargar el PDF desde Supabase Storage.")
  }

  if (fileBlob.size > MAX_PDF_SIZE_BYTES) {
    throw new Error(
      `El archivo pesa ${(fileBlob.size / 1024 / 1024).toFixed(1)} MB y excede el límite de ${MAX_PDF_SIZE_MB} MB.`
    )
  }

  const arrayBuffer = await fileBlob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const sha256 = createHash("sha256").update(buffer).digest("hex")

  const pdfResult = await extractTextWithPdfParse(buffer)

  let chosen: ExtractorResult = pdfResult

  if (!chosen.success) {
    const ocrResult = await extractTextWithOCR(
      buffer,
      filename || filePath.split("/").pop() || "documento.pdf"
    )
    if (ocrResult.success) chosen = ocrResult
  }

  if (!chosen.success && buffer.byteLength <= MAX_GEMINI_INLINE_PDF_BYTES) {
    const geminiResult = await extractTextWithGemini(buffer.toString("base64"), title)
    if (geminiResult.success) chosen = geminiResult
  }

  const extractedText = cleanText(chosen.text)
  const pages = chosen.pages?.length ? chosen.pages : buildPagesFromRawText(extractedText)

  if (!extractedText) {
    return {
      title,
      text: "",
      summary: "No se pudo extraer texto útil del documento.",
      pageCount: chosen.pageCount || 0,
      extractionMethod: chosen.method || "none",
      parserUsed: "internal-v2",
      ocrUsed: !!chosen.usedOCR,
      truncated: false,
      fromCache: false,
      bucket,
      filePath,
      error: true,
    }
  }

  const summary = chosen.summary || await summarizeWithGemini(title, extractedText) || "Documento procesado correctamente."
  const builtChunks = buildChunksFromPages(pages)

  const documentId = await upsertPaperDocument(supabase, {
    user_id: userId,
    bucket,
    file_path: filePath,
    title,
    raw_text: extractedText,
    summary,
    page_count: chosen.pageCount || pages.length || 1,
    extraction_method: chosen.method,
    parser_used: "internal-v2",
    ocr_used: !!chosen.usedOCR,
    source_file_size_bytes: fileBlob.size,
    source_file_sha256: sha256,
    metadata: {
      chunk_count: builtChunks.length,
    },
  })

  const chunkRows: PaperChunkRow[] = builtChunks.map((chunk, index) => ({
    document_id: documentId,
    user_id: userId,
    chunk_index: index,
    section_title: chunk.sectionTitle,
    page_start: chunk.pageStart,
    page_end: chunk.pageEnd,
    content: chunk.content,
    lexical_hint: chunk.lexicalHint,
  }))

  await replacePaperChunks(supabase, documentId, chunkRows)

  await syncLegacyExtractionCache(supabase, {
    userId,
    bucket,
    filePath,
    title,
    text: extractedText,
    summary,
    pageCount: chosen.pageCount || pages.length || 1,
    extractionMethod: chosen.method,
    fileSize: fileBlob.size,
    sha256,
  })

  return {
    title,
    text: extractedText,
    summary,
    pageCount: chosen.pageCount || pages.length || 1,
    extractionMethod: chosen.method,
    parserUsed: "internal-v2",
    ocrUsed: !!chosen.usedOCR,
    truncated: false,
    fromCache: false,
    bucket,
    filePath,
    documentId,
    chunks: chunkRows,
  }
}
