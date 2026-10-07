import { randomUUID } from "crypto"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@/lib/supabase/server"
import { normalizeChatText } from "@/lib/text/normalize-chat-text"

export const runtime = "nodejs"
export const maxDuration = 120

const MAX_FILE_BYTES = 30 * 1024 * 1024
const MAX_EXTRACTED_CHARS = 90_000
const MAX_VISUAL_PARTS = 12
const MAX_VISUAL_BYTES = 12 * 1024 * 1024

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"])
const PLAIN_EXTENSIONS = new Set(["txt", "md", "csv", "json", "html", "htm", "rtf"])

function extensionOf(name: string) {
  const clean = String(name || "").toLowerCase()
  const index = clean.lastIndexOf(".")
  return index >= 0 ? clean.slice(index + 1) : ""
}

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

function printableFallback(buffer: Buffer) {
  const raw = buffer.toString("latin1")
  const pieces = raw.match(/[\x20-\x7E\xA0-\xFF]{4,}/g) || []
  return pieces
    .map((piece) => piece.replace(/\s+/g, " ").trim())
    .filter((piece) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/.test(piece))
    .join("\n")
    .slice(0, MAX_EXTRACTED_CHARS)
}

function mimeForImageName(name: string) {
  const ext = extensionOf(name)
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
  if (ext === "webp") return "image/webp"
  return "image/png"
}

function googleKey() {
  return process.env.GEMINI_API_KEY_TEXT
    || process.env.GEMINI_API_KEY
    || process.env.GOOGLE_API_KEY
    || ""
}

async function extractVisualInformation(
  parts: Array<{ bytes: Uint8Array | Buffer; mimeType: string; label: string }>,
  promptPrefix: string,
) {
  const apiKey = googleKey()
  if (!apiKey || !parts.length) return { text: "", warning: apiKey ? "" : "Análisis visual no disponible: falta clave Gemini." }

  let totalBytes = 0
  const selected = parts.filter((part) => {
    if (totalBytes + part.bytes.byteLength > MAX_VISUAL_BYTES) return false
    totalBytes += part.bytes.byteLength
    return true
  }).slice(0, MAX_VISUAL_PARTS)

  if (!selected.length) return { text: "", warning: "Los elementos visuales exceden el límite de análisis." }

  try {
    const modelName = process.env.GEMINI_VISION_MODEL
      || process.env.GOOGLE_TEXT_MODEL_PRIMARY
      || process.env.GEMINI_TEXT_MODEL_PRIMARY
      || "gemini-2.5-flash"
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: modelName })
    const result = await model.generateContent([
      { text: `${promptPrefix}

Extrae TODO el texto visible con fidelidad. Además describe tablas, gráficos, diagramas, fórmulas, esquemas, fotografías y cualquier información visual necesaria para comprender el material.

Devuelve Markdown limpio y legible:
- decodifica entidades HTML como &#x44; o &amp;;
- no escapes pipes de tablas (usa |, no \\|);
- no devuelvas separadores escapados como \\---;
- conserva fórmulas matemáticas en LaTeX cuando corresponda;
- organiza por página, diapositiva, sección o elemento visual;
- no inventes datos que no aparezcan en el archivo.` },
      ...selected.flatMap((part) => [
        { text: `[VISUAL: ${part.label}]` },
        { inlineData: { data: Buffer.from(part.bytes).toString("base64"), mimeType: part.mimeType } },
      ]),
    ])
    return { text: String(result.response.text() || "").slice(0, MAX_EXTRACTED_CHARS), warning: "" }
  } catch (error) {
    return {
      text: "",
      warning: `No se pudo completar el análisis visual: ${error instanceof Error ? error.message : "error desconocido"}`,
    }
  }
}

async function parsePdf(buffer: Buffer) {
  const warnings: string[] = []
  let text = ""

  try {
    const pdfModule: any = await import("pdf-parse")
    const PDFParseCtor = pdfModule.PDFParse

    if (typeof PDFParseCtor === "function") {
      const parser: any = new PDFParseCtor({ data: new Uint8Array(buffer) })
      try {
        const result = await parser.getText()
        text = String(result?.text || result || "")
      } finally {
        if (typeof parser.destroy === "function") await parser.destroy().catch(() => undefined)
      }
    } else if (typeof pdfModule.default === "function") {
      const result = await pdfModule.default(buffer)
      text = String(result?.text || "")
    }
  } catch (error) {
    warnings.push(`Extracción PDF local incompleta: ${error instanceof Error ? error.message : "error"}`)
  }

  if (buffer.byteLength <= MAX_VISUAL_BYTES) {
    const visual = await extractVisualInformation(
      [{ bytes: buffer, mimeType: "application/pdf", label: "PDF completo" }],
      "Analiza este PDF como material adjunto de una conversación educativa.",
    )
    if (visual.warning) warnings.push(visual.warning)
    if (visual.text) text = [text.trim(), "ANÁLISIS VISUAL Y CONTENIDO DEL PDF", visual.text].filter(Boolean).join("\n\n")
  }

  return { text: text.slice(0, MAX_EXTRACTED_CHARS), warnings, kind: "pdf" }
}

async function parseDocx(buffer: Buffer) {
  const warnings: string[] = []
  const mammothModule: any = await import("mammoth")
  const mammoth: any = mammothModule.default || mammothModule
  const visuals: Array<{ bytes: Uint8Array; mimeType: string; label: string }> = []

  const convertImage = mammoth.images.imgElement(async (image: any) => {
    if (visuals.length < MAX_VISUAL_PARTS) {
      const base64 = await image.read("base64")
      visuals.push({
        bytes: new Uint8Array(Buffer.from(base64, "base64")),
        mimeType: String(image.contentType || "image/png"),
        label: `Imagen Word ${visuals.length + 1}`,
      })
    }
    return { src: "" }
  })

  const [raw, html] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }, { convertImage }),
  ])

  let text = String(raw?.value || "")
  const htmlText = String(html?.value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()

  if (htmlText && !text.includes(htmlText.slice(0, 300))) {
    text = [text, "ESTRUCTURA DEL DOCUMENTO", htmlText].filter(Boolean).join("\n\n")
  }

  if (visuals.length) {
    const visual = await extractVisualInformation(visuals, "Analiza las imágenes embebidas en este documento Word.")
    if (visual.warning) warnings.push(visual.warning)
    if (visual.text) text += `\n\nINFORMACIÓN DE IMÁGENES EMBEBIDAS\n${visual.text}`
  }

  return { text: text.slice(0, MAX_EXTRACTED_CHARS), warnings, kind: "word" }
}

async function parseWorkbook(buffer: Buffer) {
  const XLSX: any = await import("xlsx")
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, cellFormula: true })
  const sections: string[] = []

  for (const sheetName of workbook.SheetNames || []) {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    sections.push(`HOJA: ${sheetName}\n${csv}`)
    if (sections.join("\n\n").length >= MAX_EXTRACTED_CHARS) break
  }

  return {
    text: sections.join("\n\n").slice(0, MAX_EXTRACTED_CHARS),
    warnings: [] as string[],
    kind: "spreadsheet",
  }
}

function pptxXmlText(xml: string) {
  const normalized = xml
    .replace(/<a:br\s*\/>/gi, "\n")
    .replace(/<a:tab\s*\/>/gi, "\t")
    .replace(/<\/a:p>/gi, "\n")

  const values: string[] = []
  for (const match of normalized.matchAll(/<(?:a:t|c:v|c:f)[^>]*>([\s\S]*?)<\/(?:a:t|c:v|c:f)>/gi)) {
    const value = decodeXml(match[1].replace(/<[^>]+>/g, "")).trim()
    if (value) values.push(value)
  }
  return values.join(" ")
}

async function parsePptx(buffer: Buffer) {
  const warnings: string[] = []
  const fflate: any = await import("fflate")
  const entries = fflate.unzipSync(new Uint8Array(buffer))
  const sections: string[] = []
  const visuals: Array<{ bytes: Uint8Array; mimeType: string; label: string }> = []

  const slideKeys = Object.keys(entries)
    .filter((key) => /^ppt\/slides\/slide\d+\.xml$/i.test(key))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1] || 0) - Number(b.match(/slide(\d+)/i)?.[1] || 0))

  for (const key of slideKeys) {
    const slideNumber = Number(key.match(/slide(\d+)/i)?.[1] || sections.length + 1)
    const xml = fflate.strFromU8(entries[key])
    const text = pptxXmlText(xml)
    sections.push(`DIAPOSITIVA ${slideNumber}\n${text || "(sin texto extraíble)"}`)
  }

  for (const key of Object.keys(entries).filter((key) => /^ppt\/(?:charts|notesSlides)\/.*\.xml$/i.test(key))) {
    const text = pptxXmlText(fflate.strFromU8(entries[key]))
    if (text) sections.push(`CONTENIDO ADICIONAL ${key}\n${text}`)
  }

  for (const key of Object.keys(entries).filter((key) => /^ppt\/media\/.+\.(png|jpe?g|webp)$/i.test(key)).slice(0, MAX_VISUAL_PARTS)) {
    visuals.push({ bytes: entries[key], mimeType: mimeForImageName(key), label: key.replace("ppt/media/", "") })
  }

  if (visuals.length) {
    const visual = await extractVisualInformation(visuals, "Analiza las imágenes y gráficos incrustados en esta presentación PowerPoint.")
    if (visual.warning) warnings.push(visual.warning)
    if (visual.text) sections.push(`INFORMACIÓN VISUAL DE LA PRESENTACIÓN\n${visual.text}`)
  }

  return { text: sections.join("\n\n").slice(0, MAX_EXTRACTED_CHARS), warnings, kind: "presentation" }
}

async function parseImage(buffer: Buffer, mimeType: string, name: string) {
  const visual = await extractVisualInformation(
    [{ bytes: buffer, mimeType, label: name }],
    "Analiza esta imagen adjunta a Claw.",
  )
  return {
    text: visual.text || "(No fue posible extraer texto o información visual de la imagen.)",
    warnings: visual.warning ? [visual.warning] : [],
    kind: "image",
  }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) return Response.json({ error: "No se recibió archivo." }, { status: 400 })
    if (file.size <= 0) return Response.json({ error: "El archivo está vacío." }, { status: 400 })
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: "El archivo supera el máximo de 30 MB." }, { status: 413 })
    }

    const name = file.name || "archivo"
    const ext = extensionOf(name)
    const buffer = Buffer.from(await file.arrayBuffer())
    const mimeType = String(file.type || "").toLowerCase()

    let result: { text: string; warnings: string[]; kind: string }

    if (ext === "pdf" || mimeType === "application/pdf") {
      result = await parsePdf(buffer)
    } else if (ext === "docx" || mimeType.includes("wordprocessingml")) {
      result = await parseDocx(buffer)
    } else if (ext === "xlsx" || ext === "xls" || mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
      result = await parseWorkbook(buffer)
    } else if (ext === "pptx" || mimeType.includes("presentationml")) {
      result = await parsePptx(buffer)
    } else if (IMAGE_EXTENSIONS.has(ext) || mimeType.startsWith("image/")) {
      result = await parseImage(buffer, mimeType || mimeForImageName(name), name)
    } else if (PLAIN_EXTENSIONS.has(ext) || mimeType.startsWith("text/")) {
      result = { text: buffer.toString("utf8").slice(0, MAX_EXTRACTED_CHARS), warnings: [], kind: "text" }
    } else if (ext === "doc" || ext === "ppt") {
      result = {
        text: printableFallback(buffer),
        warnings: ["Formato Office antiguo: se realizó extracción de texto de compatibilidad. Para máxima fidelidad usa DOCX o PPTX."],
        kind: ext === "doc" ? "word-legacy" : "presentation-legacy",
      }
    } else {
      return Response.json({
        error: "Formato no compatible. Usa PDF, Word, Excel, PowerPoint, TXT/CSV/MD o imágenes JPG/JPEG/PNG/WEBP.",
      }, { status: 415 })
    }

    const text = normalizeChatText(String(result.text || "")).slice(0, MAX_EXTRACTED_CHARS)
    if (!text) {
      return Response.json({
        error: "No pude extraer información utilizable de este archivo.",
        warnings: result.warnings,
      }, { status: 422 })
    }

    return Response.json({
      id: randomUUID(),
      name,
      mimeType: mimeType || "application/octet-stream",
      size: file.size,
      kind: result.kind,
      text,
      chars: text.length,
      warnings: result.warnings,
    })
  } catch (error) {
    console.error("[Claw files] extraction failed:", error)
    return Response.json({
      error: error instanceof Error ? error.message : "No se pudo procesar el archivo.",
    }, { status: 500 })
  }
}
