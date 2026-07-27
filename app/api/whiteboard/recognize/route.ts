import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getGeminiTextKeys } from "@/lib/image-config"
import { latexToReadableText, normalizeLatexSource } from "@/lib/exam/latex-response"
import { blockSvg, segmentStrokes } from "@/lib/whiteboard/geometry"
import type {
  WhiteboardMathBlock,
  WhiteboardStroke,
} from "@/lib/whiteboard/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 45

const NO_CACHE = { "Cache-Control": "no-store, max-age=0" }
const RECOGNITION_TIMEOUT_MS = clampNumber(Number(process.env.WHITEBOARD_RECOGNITION_TIMEOUT_MS || 8500), 2500, 20000)
const GEMINI_TIMEOUT_MS = clampNumber(Number(process.env.WHITEBOARD_GEMINI_TIMEOUT_MS || 15000), 5000, 30000)
const CACHE_TTL_MS = clampNumber(Number(process.env.WHITEBOARD_RECOGNITION_CACHE_TTL_MS || 45000), 0, 180000)
const MAX_CACHE_ITEMS = clampNumber(Number(process.env.WHITEBOARD_RECOGNITION_CACHE_ITEMS || 300), 20, 1200)
const MAX_STROKES = clampNumber(Number(process.env.WHITEBOARD_RECOGNITION_MAX_STROKES || 360), 10, 900)
const MAX_POINTS_PER_STROKE = clampNumber(Number(process.env.WHITEBOARD_RECOGNITION_MAX_POINTS_PER_STROKE || 120), 12, 500)
const MIN_POINT_DISTANCE = clampNumber(Number(process.env.WHITEBOARD_RECOGNITION_MIN_POINT_DISTANCE || 2.4), 0.4, 12)
const MAX_BLOCKS = clampNumber(Number(process.env.WHITEBOARD_RECOGNITION_MAX_BLOCKS || 16), 1, 30)
const MAX_PREVIEW_BYTES = 3 * 1024 * 1024

const recognitionCache = new Map<string, { expiresAt: number; payload: RecognizedValue }>()

type RecognizeBody = {
  strokes?: WhiteboardStroke[]
  blockImages?: Record<string, string>
}

type NormalizedStrokes = { x: number[][]; y: number[][] }

type RecognizedValue = {
  latex: string
  text: string
  confidence: number | null
  type: WhiteboardMathBlock["type"]
  source: WhiteboardMathBlock["source"]
  alternatives: string[]
  warning: string | null
  providerRequestId?: string | null
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

function cleanText(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function cleanStrokes(value: unknown): WhiteboardStroke[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_STROKES).flatMap((stroke: any, index) => {
    if (!stroke || !Array.isArray(stroke.points)) return []
    const points: { x: number; y: number }[] = []
    for (const point of stroke.points) {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue
      const rounded = { x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 }
      const previous = points.at(-1)
      if (!previous || Math.hypot(rounded.x - previous.x, rounded.y - previous.y) >= MIN_POINT_DISTANCE) points.push(rounded)
    }
    if (!points.length) return []
    if (points.length > MAX_POINTS_PER_STROKE) {
      const sampled: typeof points = []
      const step = (points.length - 1) / (MAX_POINTS_PER_STROKE - 1)
      for (let item = 0; item < MAX_POINTS_PER_STROKE; item += 1) sampled.push(points[Math.round(item * step)])
      return [{ id: cleanText(stroke.id, 100) || `stroke-${index + 1}`, points: sampled }]
    }
    return [{ id: cleanText(stroke.id, 100) || `stroke-${index + 1}`, points }]
  })
}

function normalizeForProvider(strokes: WhiteboardStroke[]): NormalizedStrokes {
  const allPoints = strokes.flatMap((stroke) => stroke.points)
  const minX = allPoints.length ? Math.min(...allPoints.map((point) => point.x)) : 0
  const minY = allPoints.length ? Math.min(...allPoints.map((point) => point.y)) : 0
  return {
    x: strokes.map((stroke) => stroke.points.map((point) => Math.round(point.x - minX + 20))),
    y: strokes.map((stroke) => stroke.points.map((point) => Math.round(point.y - minY + 20))),
  }
}

function readProviderHeaders() {
  const headers: Record<string, string> = {}
  const rawHeaders = process.env.WHITEBOARD_RECOGNITION_HEADERS_JSON
  if (rawHeaders) {
    try {
      Object.assign(headers, JSON.parse(rawHeaders) as Record<string, string>)
    } catch {
      console.warn("[whiteboard/recognize] WHITEBOARD_RECOGNITION_HEADERS_JSON no es válido")
    }
  }
  if (process.env.MATHPIX_APP_ID) headers.app_id = process.env.MATHPIX_APP_ID
  if (process.env.MATHPIX_APP_KEY) headers.app_key = process.env.MATHPIX_APP_KEY
  return headers
}

function providerEndpoint() {
  if (process.env.WHITEBOARD_RECOGNITION_URL?.trim()) return process.env.WHITEBOARD_RECOGNITION_URL.trim()
  if (process.env.MATHPIX_APP_ID && process.env.MATHPIX_APP_KEY) return "https://api.mathpix.com/v3/strokes"
  return ""
}

function buildProviderPayload(strokes: NormalizedStrokes) {
  const mode = String(process.env.WHITEBOARD_RECOGNITION_PAYLOAD_MODE || "mathpix").trim().toLowerCase()
  const formats = String(process.env.WHITEBOARD_RECOGNITION_FORMATS || "latex_styled,text")
    .split(",")
    .map((format) => format.trim())
    .filter(Boolean)

  if (mode === "raw") return strokes
  if (mode === "legacy-flat") return { strokes, formats }
  if (mode === "legacy-nested") return { strokes: { strokes }, formats }
  return { strokes: { strokes }, formats }
}

function firstString(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim()
  return ""
}

function firstNumber(...values: unknown[]) {
  for (const value of values) if (typeof value === "number" && Number.isFinite(value)) return value
  return null
}

function classifyLatex(latex: string): WhiteboardMathBlock["type"] {
  const source = latex.trim()
  if (!source) return "unknown"
  if (/^[+-]?\d+(?:[.,]\d+)?$/.test(source)) return "number"
  if (/\\begin\{cases\}|\\left\\\{/.test(source)) return "system"
  if (/^[yfx]\s*=/.test(source.replace(/\s+/g, "")) || /\\operatorname\{f\}/.test(source)) return "function"
  if (source.includes("=")) return "equation"
  if (/\\angle|\\triangle|\\overline|\\perp|\\parallel/.test(source)) return "geometry"
  return "expression"
}

function normalizeProviderResponse(data: any): RecognizedValue {
  const rawLatex = firstString(
    data?.latex_styled,
    data?.latex,
    data?.result?.latex_styled,
    data?.result?.latex,
    data?.data?.latex_styled,
    data?.data?.latex,
  )
  const latex = normalizeLatexSource(rawLatex)
  const readable = latexToReadableText(latex)
  const providerText = firstString(data?.text, data?.result?.text, data?.data?.text)
  const confidence = firstNumber(
    data?.confidence,
    data?.confidence_rate,
    data?.result?.confidence,
    data?.result?.confidence_rate,
    data?.data?.confidence,
  )
  return {
    latex,
    text: providerText || readable,
    confidence,
    type: classifyLatex(latex),
    source: "mathpix",
    alternatives: [],
    warning: null,
    providerRequestId: firstString(data?.request_id, data?.requestId, data?.result?.request_id) || null,
  }
}

function cacheKey(strokes: NormalizedStrokes) {
  return createHash("sha256").update(JSON.stringify(strokes)).digest("hex")
}

function readCache(key: string) {
  if (!CACHE_TTL_MS) return null
  const entry = recognitionCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    recognitionCache.delete(key)
    return null
  }
  return entry.payload
}

function writeCache(key: string, payload: RecognizedValue) {
  if (!CACHE_TTL_MS || !payload.latex) return
  recognitionCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
  while (recognitionCache.size > MAX_CACHE_ITEMS) {
    const oldest = recognitionCache.keys().next().value
    if (!oldest) break
    recognitionCache.delete(oldest)
  }
}

function parseImageDataUrl(value: unknown) {
  if (typeof value !== "string") return null
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/)
  if (!match) return null
  const size = Buffer.byteLength(match[2], "base64")
  if (!size || size > MAX_PREVIEW_BYTES) return null
  return { mimeType: match[1], data: match[2] }
}

function parseGeminiJson(value: string) {
  const cleaned = value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error("Gemini no devolvió JSON válido")
  }
}

async function recognizeWithGemini(strokes: WhiteboardStroke[], previewDataUrl?: string): Promise<RecognizedValue | null> {
  const keys = getGeminiTextKeys()
  if (!keys.length) return null
  const preview = parseImageDataUrl(previewDataUrl)
  const fallbackSvg = Buffer.from(blockSvg(strokes, segmentStrokes(strokes)[0]?.bounds || { x: 0, y: 0, width: 300, height: 160 }), "utf8").toString("base64")
  const image = preview || { mimeType: "image/svg+xml", data: fallbackSvg }
  const prompt = `Analiza esta escritura matemática manuscrita. Devuelve solo JSON válido.
Reconoce también números o símbolos aislados; no exijas una ecuación completa.
No resuelvas el ejercicio. Conserva exactamente lo escrito.
Esquema:
{"latex":"...","text":"...","confidence":0.0,"type":"number|expression|equation|system|function|geometry|text|unknown","alternatives":["..."]}
Usa LaTeX sin delimitadores $ y limita alternatives a 3 posibilidades.`

  let lastError = ""
  for (const key of keys) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: image }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.05, maxOutputTokens: 600 },
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        lastError = `Gemini HTTP ${response.status}`
        continue
      }
      const payload = await response.json()
      const text = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join("") || ""
      const parsed = parseGeminiJson(text)
      const latex = normalizeLatexSource(cleanText(parsed?.latex, 2000))
      if (!latex) return null
      const allowedTypes = new Set(["number", "expression", "equation", "system", "function", "geometry", "text", "unknown"])
      return {
        latex,
        text: cleanText(parsed?.text, 2000) || latexToReadableText(latex),
        confidence: typeof parsed?.confidence === "number" ? clampNumber(parsed.confidence, 0, 1) : null,
        type: allowedTypes.has(parsed?.type) ? parsed.type : classifyLatex(latex),
        source: "gemini",
        alternatives: Array.isArray(parsed?.alternatives)
          ? parsed.alternatives.map((item: unknown) => normalizeLatexSource(cleanText(item, 800))).filter(Boolean).slice(0, 3)
          : [],
        warning: null,
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Falló Gemini"
    } finally {
      clearTimeout(timer)
    }
  }
  if (lastError) console.warn("[whiteboard/gemini]", lastError)
  return null
}

async function recognizeWithProvider(strokes: WhiteboardStroke[]): Promise<RecognizedValue | null> {
  const endpoint = providerEndpoint()
  if (!endpoint) return null
  const normalized = normalizeForProvider(strokes)
  const key = cacheKey(normalized)
  const cached = readCache(key)
  if (cached) return cached

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RECOGNITION_TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...readProviderHeaders() },
      body: JSON.stringify(buildProviderPayload(normalized)),
      cache: "no-store",
      signal: controller.signal,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.warn("[whiteboard/provider]", response.status, firstString(data?.error, data?.message))
      return null
    }
    const result = normalizeProviderResponse(data)
    if (!result.latex) return null
    writeCache(key, result)
    return result
  } catch (error) {
    console.warn("[whiteboard/provider]", error instanceof Error ? error.message : error)
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function recognizeBlock(
  block: ReturnType<typeof segmentStrokes>[number],
  preview?: string,
): Promise<WhiteboardMathBlock> {
  const provider = await recognizeWithProvider(block.strokes)
  const result = provider || await recognizeWithGemini(block.strokes, preview)
  if (!result) {
    return {
      id: block.id,
      strokeIds: block.strokeIds,
      bounds: block.bounds,
      latex: "",
      text: "",
      confidence: null,
      type: "unknown",
      status: "review",
      source: "none",
      alternatives: [],
      warning: providerEndpoint()
        ? "No se pudo reconocer este bloque. Puedes usar Editar LaTeX para corregirlo manualmente."
        : "Configura Mathpix o Gemini para reconocimiento automático. También puedes editar el LaTeX manualmente.",
    }
  }
  return {
    id: block.id,
    strokeIds: block.strokeIds,
    bounds: block.bounds,
    latex: result.latex,
    text: result.text,
    confidence: result.confidence,
    type: result.type,
    status: result.confidence !== null && result.confidence < 0.55 ? "review" : "ready",
    source: result.source,
    alternatives: result.alternatives,
    warning: result.warning,
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>) {
  const output = new Array<R>(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      output[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return output
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión para usar la pizarra." }, { status: 401, headers: NO_CACHE })

    const body = (await request.json()) as RecognizeBody
    const strokes = cleanStrokes(body?.strokes)
    if (!strokes.length) {
      return NextResponse.json({ blocks: [], latex: "", recognitionAvailable: true }, { headers: NO_CACHE })
    }

    const segmented = segmentStrokes(strokes).slice(0, MAX_BLOCKS)
    const images = body?.blockImages && typeof body.blockImages === "object" ? body.blockImages : {}
    const blocks = await mapWithConcurrency(segmented, 3, (block) => recognizeBlock(block, images[block.id]))
    const latex = blocks.filter((block) => block.latex).map((block) => block.latex).join(" \\\\ ")
    const confidenceValues = blocks.map((block) => block.confidence).filter((value): value is number => typeof value === "number")
    const confidence = confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : null

    return NextResponse.json({
      blocks,
      latex,
      confidence,
      recognitionAvailable: blocks.some((block) => block.source !== "none"),
      providerConfigured: Boolean(providerEndpoint()),
      fallbackConfigured: getGeminiTextKeys().length > 0,
    }, { headers: NO_CACHE })
  } catch (error) {
    console.error("[whiteboard/recognize]", error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : "No fue posible reconocer la escritura matemática.",
    }, { status: 500, headers: NO_CACHE })
  }
}
