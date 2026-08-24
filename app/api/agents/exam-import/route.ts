import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import {
  normalizeImportedQuestion,
  summarizeImportedQuestions,
  type ImportedExamQuestion,
} from "@/lib/exam/document-import"

export const runtime = "nodejs"
export const maxDuration = 120

const MAX_FILE_BYTES = 50 * 1024 * 1024
const MAX_INLINE_IMAGES = 30
const MAX_CONTEXT_CHARS = 180_000

const PDF_MIME = "application/pdf"
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

type ExtractedImage = {
  ref: number
  data: Uint8Array
  mimeType: string
  label: string
  page?: number
}

type ParsedDocument = {
  kind: "pdf" | "docx"
  text: string
  html?: string
  images: ExtractedImage[]
  pageImages: ExtractedImage[]
  warnings: string[]
}

function safeJson(text: string) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    const first = cleaned.indexOf("{")
    const last = cleaned.lastIndexOf("}")
    if (first >= 0 && last > first) return JSON.parse(cleaned.slice(first, last + 1))
    throw new Error("Gemini no devolvió JSON válido")
  }
}

function bytesFromUnknown(value: unknown): Uint8Array | null {
  if (!value) return null
  if (value instanceof Uint8Array) return value
  if (Buffer.isBuffer(value)) return new Uint8Array(value)
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (typeof value === "string") {
    const raw = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value
    try {
      return new Uint8Array(Buffer.from(raw, "base64"))
    } catch {
      return null
    }
  }
  return null
}

function inferMime(value: any, fallback = "image/png") {
  const candidate = String(value?.mimeType || value?.mime_type || value?.contentType || value?.content_type || value?.type || "")
  if (candidate.startsWith("image/")) return candidate
  const format = String(value?.format || value?.ext || "").toLowerCase()
  if (format.includes("jpg") || format.includes("jpeg")) return "image/jpeg"
  if (format.includes("webp")) return "image/webp"
  if (format.includes("gif")) return "image/gif"
  return fallback
}

function collectImageLikeObjects(root: any, max = MAX_INLINE_IMAGES): Array<{ data: Uint8Array; mimeType: string; page?: number }> {
  const out: Array<{ data: Uint8Array; mimeType: string; page?: number }> = []
  const seen = new Set<any>()

  function walk(value: any, depth: number) {
    if (!value || out.length >= max || depth > 6) return
    if (typeof value !== "object") return
    if (seen.has(value)) return
    seen.add(value)

    const data = bytesFromUnknown(value.data ?? value.buffer ?? value.bytes ?? value.base64 ?? value.dataUrl)
    const mimeType = inferMime(value)
    if (data && data.byteLength > 64 && mimeType.startsWith("image/")) {
      const pageRaw = Number(value.pageNumber ?? value.page ?? value.page_index)
      out.push({
        data,
        mimeType,
        page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : undefined,
      })
      return
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1)
      return
    }

    for (const [key, child] of Object.entries(value)) {
      if (["text", "content", "metadata", "font", "fonts"].includes(key)) continue
      walk(child, depth + 1)
      if (out.length >= max) break
    }
  }

  walk(root, 0)
  return out
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const warnings: string[] = []
  const images: ExtractedImage[] = []
  const pageImages: ExtractedImage[] = []
  let text = ""

  try {
    const pdfModule: any = await import("pdf-parse")
    const PDFParseCtor = pdfModule.PDFParse

    if (typeof PDFParseCtor === "function") {
      const parser: any = new PDFParseCtor({ data: new Uint8Array(buffer) })
      try {
        const textResult = await parser.getText()
        text = String(textResult?.text || textResult || "")

        if (typeof parser.getImage === "function") {
          try {
            const imageResult = await parser.getImage({ imageThreshold: 48 })
            collectImageLikeObjects(imageResult).forEach((image, index) => {
              images.push({ ref: index, data: image.data, mimeType: image.mimeType, label: `PDF image ${index + 1}`, page: image.page })
            })
          } catch {
            warnings.push("El PDF se pudo leer, pero no fue posible separar todas las imágenes embebidas.")
          }
        }

        if (typeof parser.getScreenshot === "function") {
          try {
            const screenshotResult = await parser.getScreenshot({ scale: 1.35 })
            collectImageLikeObjects(screenshotResult, 60).forEach((image, index) => {
              pageImages.push({
                ref: index,
                data: image.data,
                mimeType: image.mimeType || "image/png",
                label: `Página PDF ${image.page || index + 1}`,
                page: image.page || index + 1,
              })
            })
          } catch {
            // Gemini seguirá viendo el PDF original; las capturas son solo fallback visual.
          }
        }
      } finally {
        if (typeof parser.destroy === "function") await parser.destroy().catch(() => undefined)
      }
    } else if (typeof pdfModule.default === "function") {
      const result = await pdfModule.default(buffer)
      text = String(result?.text || "")
    }
  } catch {
    warnings.push("No se pudo completar la extracción auxiliar con pdf-parse; Gemini analizará el PDF visualmente.")
  }

  return { kind: "pdf", text: text.slice(0, MAX_CONTEXT_CHARS), images, pageImages, warnings }
}

async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const mammothModule: any = await import("mammoth")
  const mammoth: any = mammothModule.default || mammothModule
  const images: ExtractedImage[] = []
  const warnings: string[] = []

  const convertImage = mammoth.images.imgElement(async (image: any) => {
    const ref = images.length
    const base64 = await image.read("base64")
    const data = new Uint8Array(Buffer.from(base64, "base64"))
    images.push({
      ref,
      data,
      mimeType: String(image.contentType || "image/png"),
      label: `DOCX image ${ref + 1}`,
    })
    return { src: `eduai-image-ref:${ref}` }
  })

  const htmlResult = await mammoth.convertToHtml({ buffer }, { convertImage })
  const rawResult = await mammoth.extractRawText({ buffer })

  for (const message of htmlResult.messages || []) {
    if (String(message?.type || "").toLowerCase() === "warning") warnings.push(String(message?.message || "Advertencia de Word"))
  }

  return {
    kind: "docx",
    text: String(rawResult?.value || "").slice(0, MAX_CONTEXT_CHARS),
    html: String(htmlResult?.value || "").slice(0, MAX_CONTEXT_CHARS),
    images: images.slice(0, MAX_INLINE_IMAGES),
    pageImages: [],
    warnings,
  }
}

function buildPrompt(parsed: ParsedDocument, inferAnswers: boolean) {
  return `Eres ExamImportAgent de EduAI. Tu tarea es TRANSCRIBIR una evaluación existente con máxima fidelidad, no reescribirla ni mejorarla.

OBJETIVO
- Detecta título, tema/asignatura si aparece, instrucciones, preguntas, alternativas, verdadero/falso, desarrollo, puntajes, pauta/solucionario y apoyos visuales.
- Conserva el orden original.
- Conserva fórmulas y notación STEM. Devuelve matemática compatible con KaTeX usando $...$ o $$...$$ cuando corresponda.
- Si aparece H₂O, x², aₙ u otra notación equivalente, normalízala como $H_{2}O$, $x^{2}$, $a_{n}$ cuando sea seguro hacerlo.
- No inventes contenido del enunciado.

RESPUESTAS
- answerSource="file" SOLO cuando la respuesta/pauta está explícita en el documento.
- ${inferAnswers ? 'Si no existe pauta explícita, RESUELVE la pregunta y usa answerSource="ai_inferred".' : 'Si no existe pauta explícita, NO la resuelvas: usa answerSource="missing" y correctAnswer:null / modelAnswer:"".'}
- NUNCA uses la alternativa A/índice 0 como valor por defecto cuando no conozcas la respuesta.

IMÁGENES
- Después de este texto se adjuntan imágenes extraídas y cada una está precedida por [IMAGE_REF:n]. Si una imagen corresponde a una pregunta, devuelve imageRef:n.
- Si una alternativa tiene una imagen propia, devuelve optionImageRefs con un elemento por alternativa (número o null).
- Para PDF, si no hay IMAGE_REF utilizable pero la pregunta depende de un gráfico/diagrama/foto, devuelve imagePage con el número de página y optionImagePages si corresponde.

FORMATO JSON ESTRICTO
{
  "title": "",
  "topic": "",
  "instructions": "",
  "questions": [
    {
      "type": "multiple_choice|true_false|development|mixed_choice_development",
      "question": "",
      "options": [""],
      "correctAnswer": 0,
      "answerText": "",
      "answerSource": "file|ai_inferred|missing",
      "explanation": "",
      "solutionSteps": [],
      "modelAnswer": "",
      "expectedLatex": "",
      "rubric": [{"criteria":"","points":1}],
      "maxPoints": 1,
      "selectionPoints": 1,
      "justificationMaxPoints": 2,
      "developmentMaxPoints": 2,
      "sourcePage": 1,
      "imageRef": null,
      "imagePage": null,
      "optionImageRefs": [],
      "optionImagePages": [],
      "warnings": []
    }
  ],
  "warnings": []
}

REGLAS
- correctAnswer usa índice 0-based SOLO cuando la respuesta sea conocida.
- true_false: 0=Verdadero, 1=Falso.
- development: modelAnswer y rubric solo si existen o si se permite inferir respuesta.
- Si hay una pregunta de selección + desarrollo, usa mixed_choice_development.
- No conviertas una respuesta desconocida en 0.
- No devuelvas markdown alrededor del JSON.

TEXTO EXTRAÍDO AUXILIAR (${parsed.kind.toUpperCase()}):
${parsed.text || "(sin texto extraíble; usa la vista visual del documento)"}
${parsed.html ? `\nHTML SEMÁNTICO DOCX:\n${parsed.html}` : ""}`
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!url || !key) return null
  return createSupabaseAdmin(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg"
  if (mimeType.includes("webp")) return "webp"
  if (mimeType.includes("gif")) return "gif"
  return "png"
}

async function persistImage(userId: string, source: ExtractedImage) {
  const admin = getAdminClient()
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurada para almacenar imágenes importadas")

  const ext = extensionForMime(source.mimeType)
  const storagePath = `${userId}/exam-import/${Date.now()}-${randomUUID()}.${ext}`

  const { error: uploadError } = await admin.storage
    .from("eduai-assets")
    .upload(storagePath, Buffer.from(source.data), {
      contentType: source.mimeType,
      cacheControl: "3600",
      upsert: false,
    })

  if (uploadError) throw new Error(`No se pudo guardar una imagen importada: ${uploadError.message}`)

  const { data: asset, error: assetError } = await admin
    .from("eduai_assets")
    .insert({
      owner_id: userId,
      asset_type: "image",
      title: source.label,
      mime_type: source.mimeType,
      storage_bucket: "eduai-assets",
      storage_path: storagePath,
      source_module: "exam_import",
      visibility: "shared",
      metadata: { page: source.page || null, importKind: "exam_document" },
      data_classification: "standard",
      processing_purpose: "exam_document_import",
      contains_personal_data: false,
    })
    .select("id")
    .single()

  if (assetError || !asset?.id) {
    await admin.storage.from("eduai-assets").remove([storagePath]).catch(() => undefined)
    throw new Error(`No se pudo registrar una imagen importada: ${assetError?.message || "asset inválido"}`)
  }

  return `/api/assets/exam-image?id=${asset.id}`
}

async function attachPersistedImages(userId: string, parsed: ParsedDocument, questions: ImportedExamQuestion[]) {
  const imageByRef = new Map(parsed.images.map((image) => [image.ref, image]))
  const pageByNumber = new Map(parsed.pageImages.filter((image) => image.page).map((image) => [image.page as number, image]))
  const persisted = new Map<string, string>()
  const warnings: string[] = []

  async function resolve(source: ExtractedImage | undefined, cacheKey: string) {
    if (!source) return ""
    const existing = persisted.get(cacheKey)
    if (existing) return existing
    try {
      const url = await persistImage(userId, source)
      persisted.set(cacheKey, url)
      return url
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "No se pudo almacenar una imagen")
      return ""
    }
  }

  for (const question of questions) {
    if (question.imageRef !== null && question.imageRef !== undefined) {
      question.imageUrl = await resolve(imageByRef.get(question.imageRef), `ref:${question.imageRef}`)
    } else if (question.imagePage) {
      question.imageUrl = await resolve(pageByNumber.get(question.imagePage), `page:${question.imagePage}`)
      if (!question.imageUrl) question.importWarnings = [...(question.importWarnings || []), `La pregunta requiere apoyo visual de la página ${question.imagePage}, pero no se pudo separar esa imagen.`]
    }

    const maxOptions = question.options?.length || Math.max(question.optionImageRefs?.length || 0, question.optionImagePages?.length || 0)
    if (maxOptions > 0) {
      const urls: string[] = []
      for (let i = 0; i < maxOptions; i += 1) {
        const ref = question.optionImageRefs?.[i]
        const page = question.optionImagePages?.[i]
        if (ref !== null && ref !== undefined) urls[i] = await resolve(imageByRef.get(ref), `ref:${ref}`)
        else if (page !== null && page !== undefined) urls[i] = await resolve(pageByNumber.get(page), `page:${page}`)
        else urls[i] = ""
      }
      question.optionImageUrls = urls
    }
  }

  return { usedImages: persisted.size, warnings }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const form = await request.formData()
    const file = form.get("file")
    const inferAnswers = String(form.get("inferAnswers") || "false") === "true"

    if (!(file instanceof File)) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 })
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "El archivo debe pesar como máximo 50 MB" }, { status: 413 })
    }

    const lowerName = file.name.toLowerCase()
    const isPdf = lowerName.endsWith(".pdf") || file.type === PDF_MIME
    const isDocx = lowerName.endsWith(".docx") || file.type === DOCX_MIME
    if (!isPdf && !isDocx) return NextResponse.json({ error: "Solo se aceptan archivos PDF o DOCX" }, { status: 415 })

    const buffer = Buffer.from(await file.arrayBuffer())
    if (isPdf && buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return NextResponse.json({ error: "La firma del archivo no corresponde a un PDF válido" }, { status: 415 })
    }
    if (isDocx && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
      return NextResponse.json({ error: "El archivo DOCX no tiene una firma ZIP válida" }, { status: 415 })
    }

    const parsed = isPdf ? await parsePdf(buffer) : await parseDocx(buffer)

    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || ""
    if (!key) return NextResponse.json({ error: "Falta GEMINI_API_KEY en el servidor" }, { status: 503 })

    const genAI = new GoogleGenerativeAI(key)
    const modelName = process.env.GEMINI_DOCUMENT_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash"
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    })

    const parts: any[] = [{ text: buildPrompt(parsed, inferAnswers) }]
    if (isPdf) {
      parts.push({ inlineData: { mimeType: PDF_MIME, data: buffer.toString("base64") } })
    }

    for (const image of parsed.images.slice(0, MAX_INLINE_IMAGES)) {
      parts.push({ text: `[IMAGE_REF:${image.ref}] ${image.label}${image.page ? ` page=${image.page}` : ""}` })
      parts.push({ inlineData: { mimeType: image.mimeType, data: Buffer.from(image.data).toString("base64") } })
    }

    const result = await model.generateContent(parts)
    const output = safeJson(result.response.text())
    const rawQuestions = Array.isArray(output?.questions) ? output.questions : []
    if (!rawQuestions.length) return NextResponse.json({ error: "No se detectaron preguntas en el documento" }, { status: 422 })

    const questions: ImportedExamQuestion[] = rawQuestions.map((raw: any) => normalizeImportedQuestion(raw))
    const statsBeforeImages = summarizeImportedQuestions(questions)

    if (!inferAnswers && statsBeforeImages.inferredAnswers > 0) {
      // Fail closed: si el modelo intentó resolver pese a la instrucción, se descarta esa pauta.
      for (const q of questions) {
        if (q.answerSource === "ai_inferred") {
          q.answerSource = "missing"
          if (q.type === "development") q.modelAnswer = ""
          else q.correctAnswer = null
        }
      }
    }

    const stats = summarizeImportedQuestions(questions)
    const imageAttachment = await attachPersistedImages(user.id, parsed, questions)
    const warnings = [
      ...parsed.warnings,
      ...(Array.isArray(output?.warnings) ? output.warnings.map(String) : []),
      ...imageAttachment.warnings,
      ...questions.flatMap((q) => q.importWarnings || []),
    ].filter(Boolean)

    return NextResponse.json({
      success: true,
      exam: {
        title: String(output?.title || "").trim(),
        topic: String(output?.topic || "").trim(),
        instructions: String(output?.instructions || "").trim(),
      },
      questions,
      preview: {
        ...stats,
        imagesDetected: parsed.images.length + parsed.pageImages.length,
        imagesUsed: imageAttachment.usedImages,
        fileName: file.name,
        fileType: parsed.kind,
        model: modelName,
      },
      warnings: Array.from(new Set(warnings)).slice(0, 30),
    })
  } catch (error) {
    console.error("[exam-import]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar la evaluación" },
      { status: 500 },
    )
  }
}
