import crypto from "node:crypto"

export const STORAGE_BUCKET = "papers"
export const MAX_PDF_SIZE_MB = 50
export const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024
export const MAX_GEMINI_INLINE_PDF_MB = 15
export const MAX_GEMINI_INLINE_PDF_BYTES = MAX_GEMINI_INLINE_PDF_MB * 1024 * 1024
export const MAX_RETURN_TEXT_CHARS = 180_000
const MAX_SUMMARY_SOURCE_CHARS = 12_000

type SupabaseClientLike = any

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
  return text.slice(0, maxChars)
}

function hasUsefulExtractedText(text: string) {
  const clean = cleanText(text)
  if (!clean) return false

  if (clean.length > 500) return true

  const words = clean.split(/\s+/).filter(Boolean)
  return words.length > 80
}

function deriveTitle(filename?: string, filePath?: string) {
  if (filename) return filename.replace(/\.pdf$/i, "")
  if (!filePath) return "Documento"

  const parts = filePath.split("/")
  const last = parts[parts.length - 1]
  return decodeURIComponent(last).replace(/\.pdf$/i, "")
}

async function extractTextWithPdfParse(buffer: Buffer) {
  try {
    const pdfParse = (await import("pdf-parse")).default

    const parsed = await pdfParse(buffer)

    const text = cleanText(parsed.text || "")

    console.log("PDF PARSE LENGTH:", text.length)

    return {
      text,
      pageCount: parsed.numpages || 0,
      success: hasUsefulExtractedText(text)
    }
  } catch (err) {
    console.error("pdf-parse error:", err)
    return { text: "", pageCount: 0, success: false }
  }
}

async function extractTextWithGemini(base64: string, title: string) {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")

    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64
        }
      },
      {
        text: `Extract ALL text from this PDF.
Return ONLY JSON.

{
"title":"title",
"text":"full text",
"summary":"short summary"
}`
      }
    ])

    const raw = result.response.text()

    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}")

    const text = cleanText(json.text || "")

    return {
      text,
      summary: json.summary || "",
      success: hasUsefulExtractedText(text)
    }
  } catch (err) {
    console.error("Gemini extraction error:", err)
    return { text: "", summary: "", success: false }
  }
}

async function extractTextWithOCR(buffer: Buffer) {
  if (!process.env.OCR_SPACE_API_KEY) {
    console.warn("OCR key missing")
    return { text: "", success: false }
  }

  try {
    const uint8 = new Uint8Array(buffer)

    const formData = new FormData()

    formData.append(
      "file",
      new Blob([uint8], { type: "application/pdf" }),
      "document.pdf"
    )

    formData.append("OCREngine", "2")

    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: process.env.OCR_SPACE_API_KEY
      },
      body: formData
    })

    const data: any = await res.json()

    const text = (data.ParsedResults || [])
      .map((r: any) => r.ParsedText || "")
      .join("\n")

    const clean = cleanText(text)

    console.log("OCR LENGTH:", clean.length)

    return {
      text: clean,
      success: hasUsefulExtractedText(clean)
    }
  } catch (err) {
    console.error("OCR error:", err)
    return { text: "", success: false }
  }
}

async function summarize(title: string, text: string) {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")

    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" })

    const prompt = `
Resume este documento en 3 frases.

TÍTULO:
${title}

TEXTO:
${text.slice(0, MAX_SUMMARY_SOURCE_CHARS)}
`

    const result = await model.generateContent(prompt)

    return result.response.text()
  } catch {
    return ""
  }
}

export async function extractPaperFromStorage(params: {
  supabase: SupabaseClientLike
  userId: string
  bucket: string
  filePath: string
  filename?: string
}) {
  const { supabase, userId, bucket, filePath, filename } = params

  const title = deriveTitle(filename, filePath)

  const { data: fileBlob } = await supabase.storage.from(bucket).download(filePath)

  if (!fileBlob) {
    throw new Error("No se pudo descargar el PDF")
  }

  const arrayBuffer = await fileBlob.arrayBuffer()

  const buffer = Buffer.from(arrayBuffer)

  let text = ""
  let summary = ""
  let pageCount = 0
  let extractionMethod = "none"

  const pdf = await extractTextWithPdfParse(buffer)

  if (pdf.success) {
    text = pdf.text
    pageCount = pdf.pageCount
    extractionMethod = "pdf-parse"
  } else {
    console.log("pdf-parse falló, probando Gemini")

    if (buffer.length < MAX_GEMINI_INLINE_PDF_BYTES) {
      const gemini = await extractTextWithGemini(buffer.toString("base64"), title)

      if (gemini.success) {
        text = gemini.text
        summary = gemini.summary
        extractionMethod = "gemini"
      }
    }

    if (!text) {
      console.log("Gemini falló, probando OCR")

      const ocr = await extractTextWithOCR(buffer)

      if (ocr.success) {
        text = ocr.text
        extractionMethod = "ocr"
      }
    }
  }

  text = cleanText(text)

  if (!text) {
    return {
      title,
      text: "",
      summary: "No se pudo extraer texto del documento.",
      pageCount,
      extractionMethod
    }
  }

  if (!summary) {
    summary = await summarize(title, text)
  }

  return {
    title,
    text: truncateText(text, MAX_RETURN_TEXT_CHARS),
    summary,
    pageCount,
    extractionMethod
  }
}
