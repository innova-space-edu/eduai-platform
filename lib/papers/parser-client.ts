export interface ExternalParserPage {
  pageNumber: number
  text: string
}

export interface ExternalParserResult {
  success: boolean
  parser: string
  method: string
  title?: string
  markdown?: string
  text: string
  summary?: string
  pageCount: number
  pages: ExternalParserPage[]
  ocrUsed?: boolean
  metadata?: Record<string, any>
  error?: string
}

type ExternalParserRequest = {
  buffer?: Buffer
  sourceUrl?: string
  filename: string
  mimeType?: string
  forceOCR?: boolean
}

const EXTERNAL_PARSER_BUDGET_MS = 52_000

function cleanText(text: string) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00A0]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function buildPagesFromText(text: string): ExternalParserPage[] {
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

function parseDoclingResponse(data: any): ExternalParserResult {
  const markdown =
    typeof data?.markdown === "string" ? data.markdown :
    typeof data?.document?.markdown === "string" ? data.document.markdown :
    typeof data?.result?.markdown === "string" ? data.result.markdown :
    ""

  const text =
    typeof data?.text === "string" ? data.text :
    typeof data?.document?.text === "string" ? data.document.text :
    typeof data?.result?.text === "string" ? data.result.text :
    markdown

  const pagesRaw =
    Array.isArray(data?.pages) ? data.pages :
    Array.isArray(data?.document?.pages) ? data.document.pages :
    Array.isArray(data?.result?.pages) ? data.result.pages :
    []

  const pages: ExternalParserPage[] = pagesRaw.length
    ? pagesRaw.map((p: any, i: number) => ({
        pageNumber: Number(p?.pageNumber || p?.page || i + 1),
        text: cleanText(
          typeof p?.text === "string"
            ? p.text
            : typeof p?.markdown === "string"
            ? p.markdown
            : ""
        ),
      })).filter((p: ExternalParserPage) => !!p.text)
    : buildPagesFromText(text)

  const clean = cleanText(text || markdown)

  return {
    success: !!clean,
    parser: typeof data?.parser === "string" ? data.parser : "external-parser",
    method: typeof data?.method === "string" ? data.method : "external-parser",
    title:
      typeof data?.title === "string" ? data.title :
      typeof data?.document?.title === "string" ? data.document.title :
      typeof data?.result?.title === "string" ? data.result.title :
      undefined,
    markdown: cleanText(markdown),
    text: clean,
    pageCount:
      Number(data?.pageCount || data?.document?.pageCount || data?.result?.pageCount || pages.length || 0),
    pages,
    ocrUsed: Boolean(data?.ocrUsed || data?.document?.ocrUsed || data?.result?.ocrUsed),
    metadata:
      typeof data?.metadata === "object" && data?.metadata
        ? data.metadata
        : typeof data?.document?.metadata === "object" && data?.document?.metadata
        ? data.document.metadata
        : {},
  }
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function wakeParser(params: {
  baseUrl: string
  parserToken?: string
  totalTimeoutMs: number
}) {
  const { baseUrl, parserToken, totalTimeoutMs } = params
  const startedAt = Date.now()
  let delayMs = 1000

  while (Date.now() - startedAt < totalTimeoutMs) {
    const remaining = totalTimeoutMs - (Date.now() - startedAt)
    const attemptTimeout = Math.min(Math.max(remaining, 1000), 8_000)

    try {
      const response = await fetch(`${baseUrl}/health`, {
        method: "GET",
        headers: parserToken ? { "x-parser-token": parserToken } : undefined,
        signal: AbortSignal.timeout(attemptTimeout),
        cache: "no-store",
      })
      if (response.ok) return true
    } catch {
      // La petición /parse también puede terminar de activar el Space.
    }

    if (Date.now() - startedAt >= totalTimeoutMs) break
    await sleep(Math.min(delayMs, Math.max(totalTimeoutMs - (Date.now() - startedAt), 0)))
    delayMs = Math.min(Math.round(delayMs * 1.6), 3000)
  }

  return false
}

async function postParse(params: {
  endpoint: string
  parserToken?: string
  timeoutMs: number
  filename: string
  mimeType: string
  forceOCR: boolean
  buffer?: Buffer
  sourceUrl?: string
}) {
  const formData = new FormData()

  if (params.sourceUrl) {
    formData.append("source_url", params.sourceUrl)
    formData.append("filename", params.filename || "documento.pdf")
  }

  if (params.buffer) {
    formData.append(
      "file",
      new Blob([new Uint8Array(params.buffer)], { type: params.mimeType }),
      params.filename || "documento.pdf"
    )
  }

  formData.append("force_ocr", params.forceOCR ? "true" : "false")

  const response = await fetch(params.endpoint, {
    method: "POST",
    headers: params.parserToken ? { "x-parser-token": params.parserToken } : undefined,
    body: formData,
    signal: AbortSignal.timeout(params.timeoutMs),
    cache: "no-store",
  })

  return {
    response,
    raw: await response.text(),
  }
}

function errorResult(message: string): ExternalParserResult {
  return {
    success: false,
    parser: "external-parser",
    method: "external-parser",
    text: "",
    pageCount: 0,
    pages: [],
    error: message,
  }
}

export async function parseDocumentWithExternalService(
  params: ExternalParserRequest
): Promise<ExternalParserResult | null> {
  const {
    buffer,
    sourceUrl,
    filename,
    mimeType = "application/pdf",
    forceOCR = false,
  } = params

  const configuredUrl = process.env.DOCLING_PARSER_URL?.trim()
  if (!configuredUrl) return null
  if (!buffer && !sourceUrl) return errorResult("No se entregó buffer ni URL firmada al parser externo.")

  const baseUrl = configuredUrl.replace(/\/$/, "")
  const endpoint = `${baseUrl}/parse`
  const parserToken = process.env.PAPER_PARSER_TOKEN?.trim()
  const wakeTimeoutMs = clampNumber(
    process.env.DOCLING_PARSER_WAKE_TIMEOUT_MS,
    8_000,
    1_000,
    12_000,
  )
  const parseTimeoutMs = clampNumber(
    process.env.DOCLING_PARSER_TIMEOUT_MS,
    38_000,
    5_000,
    42_000,
  )
  const fallbackMaxBytes = clampNumber(
    process.env.PAPER_PARSER_BUFFER_FALLBACK_MB,
    40,
    1,
    50,
  ) * 1024 * 1024
  const startedAt = Date.now()
  const remainingBudget = () => Math.max(
    EXTERNAL_PARSER_BUDGET_MS - (Date.now() - startedAt),
    0,
  )

  try {
    await wakeParser({
      baseUrl,
      parserToken,
      totalTimeoutMs: Math.min(wakeTimeoutMs, remainingBudget()),
    })

    const firstAttemptTimeout = Math.min(parseTimeoutMs, remainingBudget())
    if (firstAttemptTimeout < 1000) {
      return errorResult("El parser externo no alcanzó a iniciarse dentro del tiempo disponible.")
    }

    let attempt = await postParse({
      endpoint,
      parserToken,
      timeoutMs: firstAttemptTimeout,
      filename,
      mimeType,
      forceOCR,
      sourceUrl,
      buffer: sourceUrl ? undefined : buffer,
    })

    const retryBudget = remainingBudget()
    if (
      !attempt.response.ok &&
      sourceUrl &&
      buffer &&
      buffer.byteLength <= fallbackMaxBytes &&
      retryBudget >= 5000
    ) {
      console.warn(
        `[Paper parser] URL mode returned HTTP ${attempt.response.status}; retrying with multipart buffer.`
      )
      attempt = await postParse({
        endpoint,
        parserToken,
        timeoutMs: Math.min(parseTimeoutMs, retryBudget),
        filename,
        mimeType,
        forceOCR,
        buffer,
      })
    }

    if (!attempt.response.ok) {
      console.error("[Paper parser] HTTP", attempt.response.status, attempt.raw)
      return errorResult(`HTTP ${attempt.response.status}: ${attempt.raw || "sin detalle"}`)
    }

    let data: any = null
    try {
      data = JSON.parse(attempt.raw)
    } catch {
      console.error("[Paper parser] respuesta no JSON:", attempt.raw)
      return errorResult("La respuesta del parser no fue JSON válido.")
    }

    return parseDoclingResponse(data)
  } catch (error: any) {
    const timeoutLike = error?.name === "TimeoutError" || error?.name === "AbortError"
    console.error("[Paper parser] error:", error?.message || error)
    return errorResult(
      timeoutLike
        ? "El OCR externo tardó demasiado. Intenta nuevamente cuando el parser esté activo."
        : error?.message || "Fallo desconocido del parser externo."
    )
  }
}
