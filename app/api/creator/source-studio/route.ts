import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractFromDOCX, extractFromPDF, extractFromText } from "@/lib/content-processor"
import { safeRemoteFetch } from "@/lib/safe-remote-url"

export const runtime = "nodejs"
export const maxDuration = 60

const HEADERS = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }
const MAX_REQUEST_BYTES = 24 * 1024 * 1024
const MAX_SOURCES = 8
const MAX_SOURCE_TEXT = 14_000

type SourceType = "topic" | "text" | "url" | "pdf" | "docx"

type InputSource = {
  id?: string
  type?: SourceType
  name?: string
  content?: string
  fileName?: string
}

const SOURCE_TYPES = new Set<SourceType>(["topic", "text", "url", "pdf", "docx"])

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    researchQuestion: { type: "string" },
    executiveSummary: { type: "string" },
    keyFindings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          finding: { type: "string" },
          evidence: { type: "string" },
          sourceIds: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["finding", "evidence", "sourceIds", "confidence"],
      },
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          content: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
          sourceIds: { type: "array", items: { type: "string" } },
          agreements: { type: "array", items: { type: "string" } },
          disagreements: { type: "array", items: { type: "string" } },
        },
        required: ["heading", "content", "evidence", "sourceIds", "agreements", "disagreements"],
      },
    },
    sourceComparison: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          positions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sourceId: { type: "string" },
                position: { type: "string" },
              },
              required: ["sourceId", "position"],
            },
          },
          synthesis: { type: "string" },
        },
        required: ["topic", "positions", "synthesis"],
      },
    },
    limitations: { type: "array", items: { type: "string" } },
    conclusions: { type: "array", items: { type: "string" } },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          priority: { type: "string", enum: ["high", "medium", "low"] },
          action: { type: "string" },
          rationale: { type: "string" },
          sourceIds: { type: "array", items: { type: "string" } },
        },
        required: ["priority", "action", "rationale", "sourceIds"],
      },
    },
    studyQuestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          expectedAnswer: { type: "string" },
          sourceIds: { type: "array", items: { type: "string" } },
        },
        required: ["question", "expectedAnswer", "sourceIds"],
      },
    },
  },
  required: [
    "title",
    "subtitle",
    "researchQuestion",
    "executiveSummary",
    "keyFindings",
    "sections",
    "sourceComparison",
    "limitations",
    "conclusions",
    "recommendations",
    "studyQuestions",
  ],
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

async function extractUrl(url: string) {
  const response = await safeRemoteFetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`La página respondió HTTP ${response.status}`)
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new Error("La URL debe apuntar a una página HTML")
  const cheerio = await import("cheerio")
  const html = (await response.text()).slice(0, 2_000_000)
  const $ = cheerio.load(html)
  $("script,style,nav,footer,header,aside,iframe,noscript,.ad,.advertisement").remove()
  const title = $("h1").first().text().trim() || $("title").text().trim() || "Fuente web"
  const rawText = ($("article").first().text() || $("main").first().text() || $("body").text()).replace(/\s+/g, " ").trim().slice(0, MAX_SOURCE_TEXT)
  if (!rawText) throw new Error("No se encontró contenido legible")
  return { success: true, title, rawText, wordCount: rawText.split(/\s+/).filter(Boolean).length, url }
}

async function extractSource(source: InputSource, index: number) {
  const type = source.type || "text"
  const content = typeof source.content === "string" ? source.content : ""
  const fileName = clean(source.fileName, 240)
  let extracted: any
  if (type === "topic") extracted = extractFromText(content, true)
  else if (type === "text") extracted = extractFromText(content, false)
  else if (type === "url") extracted = await extractUrl(content)
  else if (type === "pdf") extracted = await extractFromPDF(content, fileName)
  else extracted = await extractFromDOCX(content, fileName)

  if (!extracted?.success || !extracted?.rawText) throw new Error(extracted?.error || `No fue posible procesar la fuente ${index + 1}`)
  const sourceId = `S${index + 1}`
  return {
    id: sourceId,
    type,
    name: clean(source.name, 160) || extracted.title || fileName || `Fuente ${index + 1}`,
    title: extracted.title || fileName || `Fuente ${index + 1}`,
    url: type === "url" ? content : null,
    fileName: fileName || null,
    wordCount: extracted.wordCount || 0,
    text: String(extracted.rawText).slice(0, MAX_SOURCE_TEXT),
  }
}

function bibliographyEntry(source: any, style: string) {
  const date = new Date().toISOString().slice(0, 10)
  if (style === "simple") return `[${source.id}] ${source.title}${source.url ? ` — ${source.url}` : ""}`
  if (style === "mla") return `${source.title}. ${source.url || source.fileName || "Documento aportado"}. Consultado el ${date}.`
  return `${source.title}. (${new Date().getFullYear()}). ${source.url || source.fileName || "Documento aportado por el usuario"}.`
}

export async function POST(request: NextRequest) {
  const declared = Number(request.headers.get("content-length") || 0)
  if (declared > MAX_REQUEST_BYTES) return NextResponse.json({ error: "El conjunto de fuentes supera el límite de 24 MB." }, { status: 413, headers: HEADERS })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: HEADERS })

  const body = await request.json().catch(() => null)
  const sources = Array.isArray(body?.sources) ? body.sources.slice(0, MAX_SOURCES) as InputSource[] : []
  const researchQuestion = clean(body?.researchQuestion, 1200)
  const title = clean(body?.title, 240)
  const bibliographyStyle = ["apa", "mla", "simple"].includes(body?.bibliographyStyle) ? body.bibliographyStyle : "apa"
  const strictSources = body?.strictSources !== false

  if (sources.length < 2) return NextResponse.json({ error: "Agrega al menos dos fuentes." }, { status: 400, headers: HEADERS })
  for (const [index, source] of sources.entries()) {
    if (!SOURCE_TYPES.has(source.type || "text")) return NextResponse.json({ error: `La fuente ${index + 1} tiene un tipo no compatible.` }, { status: 400, headers: HEADERS })
    if (!source.content || typeof source.content !== "string") return NextResponse.json({ error: `La fuente ${index + 1} no tiene contenido.` }, { status: 400, headers: HEADERS })
  }

  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: "El motor de análisis no está configurado." }, { status: 503, headers: HEADERS })

  try {
    const extracted = []
    for (const [index, source] of sources.entries()) extracted.push(await extractSource(source, index))

    const sourceBlock = extracted.map((source) => `### [${source.id}] ${source.name}\nTipo: ${source.type}${source.url ? `\nURL: ${source.url}` : ""}\nContenido:\n${source.text}`).join("\n\n---\n\n")
    const prompt = `Actúa como investigador educativo y analista de fuentes.
Título solicitado: ${title || "Síntesis fundamentada"}
Pregunta de investigación: ${researchQuestion || "Identifica y explica las ideas principales que se desprenden del conjunto de fuentes."}
Modo estricto: ${strictSources ? "SÍ. Usa exclusivamente las fuentes entregadas." : "Prioriza las fuentes entregadas; no agregues afirmaciones externas no verificables."}

FUENTES:
${sourceBlock}

Reglas obligatorias:
- Cada afirmación factual debe incluir en su texto una o más citas entre corchetes: [S1], [S2] o [S1, S3].
- sourceIds debe contener solamente identificadores existentes.
- No atribuyas una idea a una fuente que no la contiene.
- Distingue acuerdos, diferencias, contradicciones y vacíos.
- No inventes datos, autores, páginas ni fechas.
- Cuando la evidencia sea insuficiente, dilo explícitamente y baja la confianza.
- No copies fragmentos largos; resume y parafrasea.
- El informe debe ser útil como base para una presentación, guía, evaluación, infografía u otro material educativo.
- Escribe en español de Chile claro, formal y pedagógico.
- Devuelve solamente JSON conforme al esquema.`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 11_000,
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(55_000),
    })

    if (!response.ok) {
      console.error("[SourceStudio]", response.status, await response.text())
      return NextResponse.json({ error: "El motor no pudo analizar las fuentes." }, { status: 502, headers: HEADERS })
    }
    const payload = await response.json()
    const raw = payload?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return NextResponse.json({ error: "El motor no devolvió resultados." }, { status: 502, headers: HEADERS })
    const data = JSON.parse(raw)

    const safeIds = new Set(extracted.map((source) => source.id))
    const normalizeIds = (value: unknown) => Array.isArray(value) ? value.map(String).filter((id) => safeIds.has(id)) : []
    data.keyFindings = Array.isArray(data.keyFindings) ? data.keyFindings.map((item: any) => ({ ...item, sourceIds: normalizeIds(item.sourceIds) })) : []
    data.sections = Array.isArray(data.sections) ? data.sections.map((item: any) => ({ ...item, sourceIds: normalizeIds(item.sourceIds) })) : []
    data.recommendations = Array.isArray(data.recommendations) ? data.recommendations.map((item: any) => ({ ...item, sourceIds: normalizeIds(item.sourceIds) })) : []
    data.studyQuestions = Array.isArray(data.studyQuestions) ? data.studyQuestions.map((item: any) => ({ ...item, sourceIds: normalizeIds(item.sourceIds) })) : []

    data._sources = extracted.map(({ text: _text, ...source }) => ({ ...source, bibliography: bibliographyEntry(source, bibliographyStyle) }))
    data.references = data._sources.map((source: any) => source.bibliography)
    data._grounding = {
      strictSources,
      bibliographyStyle,
      sourceCount: extracted.length,
      generatedAt: new Date().toISOString(),
    }
    data._design = {
      id: "admin-pro-dashboard",
      palette: {
        primary: "#4f46e5",
        secondary: "#0ea5e9",
        accent: "#f97316",
        background: "#f8fafc",
        surface: "#ffffff",
        text: "#111827",
        muted: "#64748b",
      },
    }

    return NextResponse.json({ success: true, data, sources: data._sources }, { headers: HEADERS })
  } catch (error) {
    console.error("[SourceStudio]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 260) : "El análisis falló." }, { status: 500, headers: HEADERS })
  }
}
