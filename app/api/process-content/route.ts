import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  extractFromDOCX,
  extractFromPDF,
  extractFromText,
  processContent,
  structureWithAI,
  type SourceType,
  type OutputFormat,
} from "@/lib/content-processor"
import { safeRemoteFetch } from "@/lib/safe-remote-url"

export const maxDuration = 60
export const runtime = "nodejs"

const VALID_SOURCES: SourceType[] = ["url", "text", "topic", "pdf", "docx"]
const VALID_FORMATS: OutputFormat[] = [
  "infographic", "ppt", "poster", "podcast", "mindmap", "flashcards", "quiz",
  "timeline", "cornell", "glossary", "story", "song", "lessonplan",
]
const MAX_REQUEST_BYTES = 22 * 1024 * 1024
const MAX_TEXT_CHARS = 180_000
const NO_CACHE_HEADERS = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function requestId(request: NextRequest) {
  return request.headers.get("x-request-id") || crypto.randomUUID()
}

async function extractSafeUrl(url: string) {
  const response = await safeRemoteFetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`La página respondió HTTP ${response.status}`)
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("La URL debe apuntar a una página HTML")
  }
  const html = (await response.text()).slice(0, 2_000_000)
  const cheerio = await import("cheerio")
  const $ = cheerio.load(html)
  $("script, style, nav, footer, header, aside, iframe, noscript, .ad, .advertisement").remove()
  const title = $("h1").first().text().trim() || $("title").text().trim() || "Fuente web"
  const raw = ($("article").first().text() || $("main").first().text() || $("body").text())
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12_000)
  if (!raw) throw new Error("No se encontró contenido legible en la página")
  return extractFromText(`Fuente: ${title}\nURL: ${url}\n\n${raw}`, false)
}

async function getCustomTemplate(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, designTemplateId: string) {
  if (!designTemplateId.startsWith("custom:")) return null
  const id = designTemplateId.slice("custom:".length)
  const modern = await supabase
    .from("creative_templates")
    .select("id, name, prompt, file_name, mime_type, file_kind, formats, accent_color, secondary_color, instructions, storage_path, preview_path, is_creator_template")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()

  if (!modern.error && modern.data) return modern.data
  if (modern.error?.code !== "42703") return null

  const legacy = await supabase
    .from("creative_templates")
    .select("id, name, prompt, storage_path")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()
  if (legacy.error || !legacy.data) return null

  let metadata: any = {}
  if (legacy.data.prompt?.startsWith("__CREATOR_TEMPLATE__")) {
    try { metadata = JSON.parse(legacy.data.prompt.slice("__CREATOR_TEMPLATE__".length)) } catch {}
  }
  return { ...legacy.data, ...metadata, instructions: metadata.instructions || "", accent_color: metadata.accentColor, secondary_color: metadata.secondaryColor, file_name: metadata.fileName, file_kind: metadata.fileKind, formats: metadata.formats || [], is_creator_template: true }
}

function templateDirective(template: any) {
  return [
    "PLANTILLA PERSONALIZADA DEL USUARIO:",
    `Nombre: ${template?.name || "Plantilla personalizada"}`,
    template?.file_name ? `Archivo de referencia: ${template.file_name}` : "",
    template?.file_kind ? `Tipo de archivo: ${template.file_kind}` : "",
    template?.accent_color ? `Color principal obligatorio: ${template.accent_color}` : "",
    template?.secondary_color ? `Color secundario: ${template.secondary_color}` : "",
    template?.instructions ? `Instrucciones visuales y estructurales: ${template.instructions}` : "",
    "Respeta estas instrucciones al organizar el contenido. El resultado debe continuar siendo completamente editable por capas.",
  ].filter(Boolean).join("\n")
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  const headers = { ...NO_CACHE_HEADERS, "X-Request-Id": id }
  const declaredLength = Number(request.headers.get("content-length") || 0)
  if (declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ success: false, error: "El archivo o contenido supera el límite permitido de 22 MB." }, { status: 413, headers })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Debes iniciar sesión para crear materiales." }, { status: 401, headers })

  try {
    const body = await request.json()
    const sourceType = body?.sourceType as SourceType
    const outputFormat = body?.outputFormat as OutputFormat
    const content = typeof body?.content === "string" ? body.content : ""
    const fileName = cleanText(body?.fileName, 240)
    const designTemplateId = cleanText(body?.designTemplateId, 180)

    if (!sourceType || !content || !outputFormat) {
      return NextResponse.json({ success: false, error: "Faltan la fuente, el contenido o el formato de salida." }, { status: 400, headers })
    }
    if (!VALID_SOURCES.includes(sourceType)) {
      return NextResponse.json({ success: false, error: "Tipo de fuente no compatible." }, { status: 400, headers })
    }
    if (!VALID_FORMATS.includes(outputFormat)) {
      return NextResponse.json({ success: false, error: "Formato de material no compatible." }, { status: 400, headers })
    }
    if ((sourceType === "topic" || sourceType === "text" || sourceType === "url") && content.length > MAX_TEXT_CHARS) {
      return NextResponse.json({ success: false, error: "El texto es demasiado extenso. Divide el contenido en una fuente más breve." }, { status: 413, headers })
    }
    if ((sourceType === "pdf" || sourceType === "docx") && content.length > MAX_REQUEST_BYTES * 1.4) {
      return NextResponse.json({ success: false, error: "El documento supera el tamaño permitido." }, { status: 413, headers })
    }

    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) return NextResponse.json({ success: false, error: "El motor de generación no está configurado." }, { status: 503, headers })

    const customTemplate = await getCustomTemplate(supabase, user.id, designTemplateId)
    let preparedSource: SourceType = sourceType
    let preparedContent = content

    if (sourceType === "url") {
      const extracted = await extractSafeUrl(content)
      preparedSource = "text"
      preparedContent = extracted.rawText || ""
    }

    if (!customTemplate) {
      const result = await processContent({
        sourceType: preparedSource,
        content: preparedContent,
        fileName,
        outputFormat,
        geminiKey,
        designTemplateId,
      })
      if (!result.success) return NextResponse.json({ success: false, error: result.error || "No fue posible generar el material." }, { status: 422, headers })
      return NextResponse.json(result, { headers })
    }

    let extracted: any
    if (preparedSource === "topic") extracted = extractFromText(preparedContent, true)
    else if (preparedSource === "text") extracted = extractFromText(preparedContent, false)
    else if (preparedSource === "pdf") extracted = await extractFromPDF(preparedContent, fileName)
    else if (preparedSource === "docx") extracted = await extractFromDOCX(preparedContent, fileName)
    else extracted = extractFromText(preparedContent, false)

    if (!extracted.success) return NextResponse.json({ success: false, error: extracted.error || "No fue posible leer la fuente." }, { status: 422, headers })
    extracted.rawText = `${extracted.rawText || ""}\n\n${templateDirective(customTemplate)}`.slice(0, 16_000)

    const structured = await structureWithAI(extracted, outputFormat, geminiKey)
    if (!structured.success) return NextResponse.json({ success: false, error: "No fue posible estructurar el material con la plantilla seleccionada." }, { status: 422, headers })

    return NextResponse.json({
      success: true,
      source: {
        type: extracted.sourceType || preparedSource,
        title: extracted.title || fileName || "Fuente",
        wordCount: extracted.wordCount || 0,
        url: sourceType === "url" ? content : null,
      },
      output: {
        format: outputFormat,
        data: {
          ...(structured.data || {}),
          _design: {
            id: designTemplateId,
            name: customTemplate.name,
            custom: true,
            sourceFile: customTemplate.file_name || null,
            instructions: customTemplate.instructions || null,
            palette: {
              primary: customTemplate.accent_color || "#7c3aed",
              secondary: customTemplate.secondary_color || "#06b6d4",
              accent: customTemplate.accent_color || "#7c3aed",
              background: "#f8fafc",
              surface: "#ffffff",
              text: "#0f172a",
              muted: "#64748b",
            },
          },
        },
      },
      processedAt: new Date().toISOString(),
    }, { headers })
  } catch (error) {
    console.error(`[Creator][${id}]`, error)
    const message = error instanceof Error ? error.message : "Error inesperado"
    const safeMessage = /URL|página|documento|contenido|plantilla|archivo/i.test(message)
      ? message.slice(0, 260)
      : "Ocurrió un error interno al generar el material."
    return NextResponse.json({ success: false, error: safeMessage, requestId: id }, { status: 500, headers })
  }
}
