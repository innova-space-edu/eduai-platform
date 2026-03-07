import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const MAX_PDF_SIZE_MB = 3.5
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024
const MAX_RETURN_TEXT_CHARS = 150_000

function cleanText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function truncateText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + "\n\n[Texto truncado por límite interno de procesamiento]"
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
      text: cleanText(data.text || ""),
      summary: (data.summary || "").trim(),
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
${extractedText.slice(0, 12000)}
    `.trim()

    const result = await model.generateContent(prompt)
    const summary = result.response.text().trim()

    return summary || "No se pudo generar un resumen automático."
  } catch (error) {
    console.error("Gemini summary failed:", error)
    return "No se pudo generar un resumen automático."
  }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const formData = await req.formData()
    const fileValue = formData.get("file")

    if (!fileValue || typeof fileValue === "string") {
      return Response.json(
        { error: "No se recibió ningún archivo PDF." },
        { status: 400 }
      )
    }

    const file = fileValue as File
    const filename = file.name || "documento.pdf"
    const title = filename.replace(/\.pdf$/i, "") || "Documento"
    const isPdf =
      file.type === "application/pdf" || filename.toLowerCase().endsWith(".pdf")

    if (!isPdf) {
      return Response.json(
        { error: "Solo se aceptan archivos PDF." },
        { status: 400 }
      )
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      return Response.json(
        {
          error:
            `El archivo pesa ${(file.size / 1024 / 1024).toFixed(2)} MB y excede ` +
            `el límite permitido de ${MAX_PDF_SIZE_MB} MB.`,
        },
        { status: 413 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let extractedText = ""
    let summary = ""
    let pageCount = 0

    const pdfParseResult = await extractTextWithPdfParse(buffer)

    if (pdfParseResult.success && pdfParseResult.text) {
      extractedText = pdfParseResult.text
      pageCount = pdfParseResult.pageCount
      summary = await summarizeWithGemini(title, extractedText)
    } else {
      const base64 = buffer.toString("base64")
      const geminiResult = await extractTextWithGemini(base64, title)

      if (geminiResult.success && geminiResult.text) {
        extractedText = geminiResult.text
        summary =
          geminiResult.summary || "No se pudo generar un resumen automático."
      }
    }

    extractedText = cleanText(extractedText)

    if (!extractedText) {
      return Response.json(
        {
          title,
          text: "",
          summary: "No se pudo extraer el texto automáticamente.",
          pageCount,
          error: true,
        },
        { status: 200 }
      )
    }

    const finalText = truncateText(extractedText, MAX_RETURN_TEXT_CHARS)

    return Response.json({
      title,
      text: finalText,
      summary: summary || "No se pudo generar un resumen automático.",
      pageCount,
      truncated: finalText.length < extractedText.length,
    })
  } catch (error: any) {
    console.error("PDF extraction error:", error)

    return Response.json(
      {
        title: "Documento",
        text: "",
        summary: "No se pudo extraer el texto automáticamente.",
        error: true,
      },
      { status: 500 }
    )
  }
}
