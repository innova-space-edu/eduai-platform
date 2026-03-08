import crypto from "node:crypto"

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
  return (
    text.slice(0, maxChars) +
    "\n\n[Texto truncado por límite interno de procesamiento]"
  )
}

function getString(value: unknown) {
  return typeof value === "string" ? value : ""
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

function hasUsefulExtractedText(text: string) {
  const clean = cleanText(text)
  if (!clean) return false
  if (clean.length >= 500) return true
  return clean.split(/\s+/).filter(Boolean).length >= 80
}

export async function getCachedPaperExtraction(
  supabase: SupabaseClientLike,
  userId: string,
  bucket: string,
  filePath: string
): Promise<CachedPaperExtraction | null> {
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
}

export async function upsertPaperExtraction(
  supabase: SupabaseClientLike,
  row: CachedPaperExtraction
) {
  const { error } = await supabase
    .from("paper_extractions")
    .upsert(row, {
      onConflict: "user_id,bucket,file_path",
    })

  if (error) {
    console.error("paper_extractions upsert error:", error)
  }
}

async function extractTextWithPdfParse(buffer: Buffer) {
  try {
    const pdfParseModule: any = await import("pdf-parse")
    const pdfParse = pdfParseModule.default || pdfParseModule
    const parsed = await pdfParse(buffer)

    return {
      text: cleanText(parsed?.text || ""),
      pageCount: parsed?.numpages || 0,
      success: true,
    }
  } catch (error) {
    console.error("pdf-parse extraction failed:", error)
    return {
      text: "",
      pageCount: 0,
      success: false,
    }
  }
}

async function extractTextWithGemini(base64: string, title: string) {
  if (!process.env.GEMINI_API_KEY) {
    return {
      text: "",
      summary: "",
      success: false,
    }
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64,
        },
      },
      {
        text: `Extract ALL text from this document preserving structure, titles, sections and formulas.
Then generate a 3-4 sentence executive summary of the most important points.

IMPORTANT: Respond ONLY with a valid JSON object, no markdown, no backticks, no explanation:
{"title":"document title","text":"full extracted text","summary":"executive summary 3-4 sentences"}

Rules:
- Keep the original language of the document
- Preserve mathematical formulas as LaTeX when possible
- Include all sections when possible
- The summary must be in the same language as the document
- If the document title is unclear, use: "${title}"`,
      },
    ])

    const raw = result.response.text().trim()
    const data = parseGeminiJson(raw)

    if (!data) {
      return {
        text: "",
        summary: "",
        success: false,
      }
    }

    return {
      text: cleanText(getString(data.text)),
      summary: getString(data.summary).trim(),
      success: true,
    }
  } catch (error) {
    console.error("Gemini full extraction failed:", error)
    return {
      text: "",
      summary: "",
      success: false,
    }
  }
}

async function extractTextWithOcrSpace(buffer: Buffer, filename: string) {
  if (!process.env.OCR_SPACE_API_KEY) {
    return {
      text: "",
      success: false,
    }
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
    formData.append("isCreateSearchablePdf", "false")

    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: process.env.OCR_SPACE_API_KEY,
      },
      body: formData,
    })

    const data: any = await res.json().catch(() => null)

    if (!res.ok || !data) {
      return {
        text: "",
        success: false,
      }
    }

    if (data.IsErroredOnProcessing) {
      console.error("OCR.Space processing error:", data.ErrorMessage || data.ErrorDetails)
      return {
        text: "",
        success: false,
      }
    }

    const extractedText = (data.ParsedResults || [])
      .map((item: any) => item?.ParsedText || "")
      .join("\n\n")

    return {
      text: cleanText(extractedText),
      success: hasUsefulExtractedText(extractedText),
    }
  } catch (error) {
    console.error("OCR.Space extraction failed:", error)
    return {
      text: "",
      success: false,
    }
  }
}

async function summarizeWithGemini(title: string, extractedText: string) {
  if (!process.env.GEMINI_API_KEY || !extractedText.trim()) {
    return "No se pudo generar un resumen automático."
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" })

    const prompt = `
Resume este paper en 3 o 4 frases, en el mismo idioma del documento.
Debes mencionar: tema central, método, hallazgo principal y conclusión.

TÍTULO:
${title}

TEXTO:
${extractedText.slice(0, MAX_SUMMARY_SOURCE_CHARS)}
    `.trim()

    const result = await model.generateContent(prompt)
    const summary = result.response.text().trim()

    return summary || "No se pudo generar un resumen automático."
  } catch (error) {
    console.error("Gemini summary failed:", error)
    return "No se pudo generar un resumen automático."
  }
}

export async function extractPaperFromStorage(params: {
  supabase: SupabaseClientLike
  userId: string
  bucket: string
  filePath: string
  filename?: string
  forceRefresh?: boolean
}) {
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
      return {
        title: cached.title || title,
        text: cached.extracted_text,
        summary: cached.summary || "No se pudo generar un resumen automático.",
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
      `El archivo almacenado pesa ${(fileBlob.size / 1024 / 1024).toFixed(2)} MB y excede el límite permitido de ${MAX_PDF_SIZE_MB} MB.`
    )
  }

  const arrayBuffer = await fileBlob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const sourceFileSha256 = crypto.createHash("sha256").update(buffer).digest("hex")

  let extractedText = ""
  let summary = ""
  let pageCount = 0
  let extractionMethod: "pdf-parse" | "ocr-space" | "gemini-inline" | "none" = "none"

  const pdfParseResult = await extractTextWithPdfParse(buffer)

  if (pdfParseResult.success && hasUsefulExtractedText(pdfParseResult.text)) {
    extractedText = pdfParseResult.text
    pageCount = pdfParseResult.pageCount
    summary = await summarizeWithGemini(title, extractedText)
    extractionMethod = "pdf-parse"
  } else {
    const ocrResult = await extractTextWithOcrSpace(
      buffer,
      filename || filePath.split("/").pop() || "documento.pdf"
    )

    if (ocrResult.success && hasUsefulExtractedText(ocrResult.text)) {
      extractedText = ocrResult.text
      summary = await summarizeWithGemini(title, extractedText)
      extractionMethod = "ocr-space"
    } else if (buffer.byteLength <= MAX_GEMINI_INLINE_PDF_BYTES) {
      const geminiResult = await extractTextWithGemini(buffer.toString("base64"), title)

      if (geminiResult.success && hasUsefulExtractedText(geminiResult.text)) {
        extractedText = geminiResult.text
        summary =
          geminiResult.summary || (await summarizeWithGemini(title, extractedText))
        extractionMethod = "gemini-inline"
      }
    }
  }

  extractedText = cleanText(extractedText)

  if (!extractedText) {
    await upsertPaperExtraction(supabase, {
      user_id: userId,
      bucket,
      file_path: filePath,
      title,
      extracted_text: "",
      summary:
        "No se pudo extraer el texto automáticamente. Si el PDF es escaneado o muy pesado, conviene usar OCR o un pipeline por fragmentos.",
      page_count: pageCount,
      extraction_method: extractionMethod,
      truncated: false,
      source_file_size_bytes: fileBlob.size,
      source_file_sha256: sourceFileSha256,
      error_message: "No se pudo extraer texto útil.",
    })

    return {
      title,
      text: "",
      summary:
        "No se pudo extraer el texto automáticamente. Si el PDF es escaneado o muy pesado, conviene usar OCR o un pipeline por fragmentos.",
      pageCount,
      extractionMethod,
      truncated: false,
      fromCache: false,
      bucket,
      filePath,
      error: true,
    }
  }

  await upsertPaperExtraction(supabase, {
    user_id: userId,
    bucket,
    file_path: filePath,
    title,
    extracted_text: extractedText,
    summary: summary || "No se pudo generar un resumen automático.",
    page_count: pageCount,
    extraction_method: extractionMethod,
    truncated: false,
    source_file_size_bytes: fileBlob.size,
    source_file_sha256: sourceFileSha256,
    error_message: null,
  })

  return {
    title,
    text: extractedText,
    summary: summary || "No se pudo generar un resumen automático.",
    pageCount,
    extractionMethod,
    truncated: false,
    fromCache: false,
    bucket,
    filePath,
  }
}
