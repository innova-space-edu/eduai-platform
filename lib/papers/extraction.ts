import { createHash } from "node:crypto"

export const STORAGE_BUCKET = "papers"
export const MAX_PDF_SIZE_MB = 50
export const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024
export const MAX_GEMINI_INLINE_PDF_MB = 10
export const MAX_GEMINI_INLINE_PDF_BYTES = MAX_GEMINI_INLINE_PDF_MB * 1024 * 1024
export const MAX_RETURN_TEXT_CHARS = 180_000
const MAX_SUMMARY_SOURCE_CHARS = 12_000

type SupabaseClientLike = any

export interface CachedPaperExtraction {
  id?: number
  user_id: string
  bucket: string
  file_path: string
  title: string
  extracted_text: string
  summary: string
  page_count: number
  extraction_method: string
  truncated: boolean
  source_file_size_bytes?: number | null
  source_file_sha256?: string | null
  error_message?: string | null
  created_at?: string
  updated_at?: string
}

export interface PaperExtractionResult {
  title: string
  text: string
  summary: string
  pageCount: number
  extractionMethod: string
  truncated: boolean
  fromCache: boolean
  bucket: string
  filePath: string
  error?: boolean
}

// ============================================================
// UTILIDADES
// ============================================================

export function cleanText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

export function truncateText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + "\n\n[Texto truncado por límite interno]"
}

function getString(value: unknown) {
  return typeof value === "string" ? value : ""
}

function hasUsefulExtractedText(text: string) {
  const clean = cleanText(text)
  if (!clean) return false
  if (clean.length >= 500) return true
  return clean.split(/\s+/).filter(Boolean).length >= 80
}

export function deriveTitle(filename?: string, filePath?: string) {
  const cleanFilename = getString(filename).trim()
  if (cleanFilename) {
    return cleanFilename.replace(/\.pdf$/i, "") || "Documento"
  }
  const cleanPath = getString(filePath).trim()
  if (cleanPath) {
    const parts = cleanPath.split("/")
    const lastPart = decodeURIComponent(parts[parts.length - 1] || "documento.pdf")
      .replace(/^\d+-/, "")
      .replace(/^[a-f0-9-]{20,}-/i, "")
    return lastPart.replace(/\.pdf$/i, "") || "Documento"
  }
  return "Documento"
}

function parseGeminiJson(raw: string) {
  let data: any = null
  try {
    data = JSON.parse(raw)
  } catch {}

  if (!data) {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        data = JSON.parse(match[0])
      } catch {}
    }
  }

  if (!data) {
    const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (mdMatch) {
      try {
        data = JSON.parse(mdMatch[1].trim())
      } catch {}
    }
  }

  return data
}

// ============================================================
// CACHE (tabla paper_extractions — opcional, no rompe si no existe)
// ============================================================

export async function getCachedPaperExtraction(
  supabase: SupabaseClientLike,
  userId: string,
  bucket: string,
  filePath: string
): Promise<CachedPaperExtraction | null> {
  try {
    const { data, error } = await supabase
      .from("paper_extractions")
      .select("*")
      .eq("user_id", userId)
      .eq("bucket", bucket)
      .eq("file_path", filePath)
      .maybeSingle()

    if (error) {
      console.error("paper_extractions select error:", error)
      return null
    }

    return data ?? null
  } catch {
    return null
  }
}

export async function upsertPaperExtraction(
  supabase: SupabaseClientLike,
  row: CachedPaperExtraction
) {
  try {
    const { error } = await supabase
      .from("paper_extractions")
      .upsert(row, { onConflict: "user_id,bucket,file_path" })

    if (error) {
      console.error("paper_extractions upsert error:", error)
    }
  } catch {
    // tabla no existe, ignorar silenciosamente
  }
}

// ============================================================
// EXTRACTORES
// ============================================================

async function extractTextWithPdfParse(buffer: Buffer) {
  try {
    const pdfParseModule: any = await import("pdf-parse")
    const pdfParse =
      pdfParseModule.default || pdfParseModule.pdf || pdfParseModule

    const parsed = await pdfParse(buffer)
    const text = cleanText(parsed?.text || "")

    console.log("pdf-parse extracted:", text.length, "chars,", parsed?.numpages, "pages")

    return {
      text,
      pageCount: parsed?.numpages || 0,
      success: hasUsefulExtractedText(text),
    }
  } catch (error) {
    console.error("pdf-parse failed:", error)
    return { text: "", pageCount: 0, success: false }
  }
}

async function extractTextWithGemini(base64: string, title: string) {
  if (!process.env.GEMINI_API_KEY) {
    return { text: "", summary: "", success: false }
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" })

    const result = await model.generateContent([
      { inlineData: { mimeType: "application/pdf", data: base64 } },
      {
        text: `Extract ALL text from this document preserving structure, titles, sections and formulas.
Then generate a 3-4 sentence executive summary.
Respond ONLY with valid JSON, no markdown, no backticks:
{"title":"document title","text":"full extracted text","summary":"executive summary"}
Keep original language. Preserve LaTeX formulas. If title unclear use: "${title}"`,
      },
    ])

    const raw = result.response.text().trim()
    const data = parseGeminiJson(raw)

    if (!data) {
      return { text: "", summary: "", success: false }
    }

    const text = cleanText(getString(data.text))
    console.log("Gemini extracted:", text.length, "chars")

    return {
      text,
      summary: getString(data.summary).trim(),
      success: hasUsefulExtractedText(text),
    }
  } catch (error) {
    console.error("Gemini extraction failed:", error)
    return { text: "", summary: "", success: false }
  }
}

async function extractTextWithOCR(buffer: Buffer, filename: string) {
  if (!process.env.OCR_SPACE_API_KEY) {
    console.warn("OCR_SPACE_API_KEY not set, skipping OCR")
    return { text: "", success: false }
  }

  try {
    const formData = new FormData()
    const uint8 = new Uint8Array(buffer)

    formData.append(
      "file",
      new Blob([uint8], { type: "application/pdf" }),
      filename || "documento.pdf"
    )
    formData.append("isOverlayRequired", "false")
    formData.append("OCREngine", "2")
    formData.append("detectOrientation", "true")
    formData.append("scale", "true")

    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: process.env.OCR_SPACE_API_KEY },
      body: formData,
    })

    const data: any = await res.json().catch(() => null)

    if (!res.ok || !data || data.IsErroredOnProcessing) {
      console.error("OCR error:", data?.ErrorMessage || data?.ErrorDetails)
      return { text: "", success: false }
    }

    const text = (data.ParsedResults || [])
      .map((r: any) => r?.ParsedText || "")
      .join("\n\n")

    const clean = cleanText(text)
    console.log("OCR extracted:", clean.length, "chars")

    return { text: clean, success: hasUsefulExtractedText(clean) }
  } catch (error) {
    console.error("OCR failed:", error)
    return { text: "", success: false }
  }
}

// ============================================================
// RESUMEN
// ============================================================

async function summarizeWithGemini(title: string, text: string) {
  if (!process.env.GEMINI_API_KEY || !text.trim()) return ""

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" })

    const result = await model.generateContent(
      `Resume este documento en 3-4 frases en el mismo idioma del documento.
Menciona: tema central, método, hallazgo principal y conclusión.

TÍTULO: ${title}

TEXTO: ${text.slice(0, MAX_SUMMARY_SOURCE_CHARS)}`
    )

    return result.response.text().trim() || ""
  } catch {
    return ""
  }
}

// ============================================================
// PIPELINE PRINCIPAL
// ============================================================

export async function extractPaperFromStorage(params: {
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
    const cached = await getCachedPaperExtraction(supabase, userId, bucket, filePath)
    if (cached?.extracted_text?.trim()) {
      console.log("Using cached extraction for:", filePath)
      return {
        title: cached.title || title,
        text: cached.extracted_text,
        summary: cached.summary || "",
        pageCount: cached.page_count || 0,
        extractionMethod: cached.extraction_method || "cache",
        truncated: false,
        fromCache: true,
        bucket,
        filePath,
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

  let sha256 = ""
  try {
    sha256 = createHash("sha256").update(buffer).digest("hex")
  } catch {}

  let extractedText = ""
  let summary = ""
  let pageCount = 0
  let extractionMethod = "none"

  console.log("Trying pdf-parse...")
  const pdfResult = await extractTextWithPdfParse(buffer)

  if (pdfResult.success && hasUsefulExtractedText(pdfResult.text)) {
    extractedText = pdfResult.text
    pageCount = pdfResult.pageCount
    extractionMethod = "pdf-parse"
    console.log("pdf-parse succeeded")
  }

  if (!extractedText) {
    console.log("Trying OCR...")
    const ocrResult = await extractTextWithOCR(
      buffer,
      filename || filePath.split("/").pop() || "documento.pdf"
    )

    if (ocrResult.success && hasUsefulExtractedText(ocrResult.text)) {
      extractedText = ocrResult.text
      extractionMethod = "ocr-space"
      console.log("OCR succeeded")
    }
  }

  if (!extractedText && buffer.byteLength <= MAX_GEMINI_INLINE_PDF_BYTES) {
    console.log("Trying Gemini inline...")
    const geminiResult = await extractTextWithGemini(buffer.toString("base64"), title)

    if (geminiResult.success && hasUsefulExtractedText(geminiResult.text)) {
      extractedText = geminiResult.text
      summary = geminiResult.summary || ""
      extractionMethod = "gemini-inline"
      console.log("Gemini inline succeeded")
    }
  }

  extractedText = cleanText(extractedText)

  if (!extractedText) {
    const errorResult: PaperExtractionResult = {
      title,
      text: "",
      summary:
        "No se pudo extraer texto del documento. Si el PDF es escaneado, intenta con uno que tenga texto seleccionable.",
      pageCount,
      extractionMethod,
      truncated: false,
      fromCache: false,
      bucket,
      filePath,
      error: true,
    }

    await upsertPaperExtraction(supabase, {
      user_id: userId,
      bucket,
      file_path: filePath,
      title,
      extracted_text: "",
      summary: errorResult.summary,
      page_count: pageCount,
      extraction_method: extractionMethod,
      truncated: false,
      source_file_size_bytes: fileBlob.size,
      source_file_sha256: sha256,
      error_message: "No text extracted",
    })

    return errorResult
  }

  if (!summary) {
    summary = await summarizeWithGemini(title, extractedText)
  }

  if (!summary) {
    summary = "Documento procesado correctamente."
  }

  await upsertPaperExtraction(supabase, {
    user_id: userId,
    bucket,
    file_path: filePath,
    title,
    extracted_text: extractedText,
    summary,
    page_count: pageCount,
    extraction_method: extractionMethod,
    truncated: false,
    source_file_size_bytes: fileBlob.size,
    source_file_sha256: sha256,
    error_message: null,
  })

  return {
    title,
    text: extractedText,
    summary,
    pageCount,
    extractionMethod,
    truncated: false,
    fromCache: false,
    bucket,
    filePath,
  }
}
