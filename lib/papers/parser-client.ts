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

export async function parseDocumentWithExternalService(params: {
  buffer: Buffer
  filename: string
  mimeType?: string
  forceOCR?: boolean
}): Promise<ExternalParserResult | null> {
  const { buffer, filename, mimeType = "application/pdf", forceOCR = false } = params
  const baseUrl = process.env.DOCLING_PARSER_URL?.trim()

  if (!baseUrl) return null

  const requestedTimeout = Number(process.env.DOCLING_PARSER_TIMEOUT_MS || 12000)
  const timeoutMs = Number.isFinite(requestedTimeout)
    ? Math.min(Math.max(requestedTimeout, 3000), 20000)
    : 12000

  try {
    const formData = new FormData()
    formData.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: mimeType }),
      filename || "document.pdf"
    )
    formData.append("force_ocr", forceOCR ? "true" : "false")

    const endpoint = `${baseUrl.replace(/\/$/, "")}/parse`
    const parserToken = process.env.PAPER_PARSER_TOKEN?.trim()

    const res = await fetch(endpoint, {
      method: "POST",
      headers: parserToken ? { "x-parser-token": parserToken } : undefined,
      body: formData,
      signal: AbortSignal.timeout(timeoutMs),
    })

    const raw = await res.text()

    if (!res.ok) {
      console.error("[Paper parser] HTTP", res.status, raw)
      return {
        success: false,
        parser: "external-parser",
        method: "external-parser",
        text: "",
        pageCount: 0,
        pages: [],
        error: `HTTP ${res.status}: ${raw || "sin detalle"}`,
      }
    }

    let data: any = null
    try {
      data = JSON.parse(raw)
    } catch {
      console.error("[Paper parser] respuesta no JSON:", raw)
      return {
        success: false,
        parser: "external-parser",
        method: "external-parser",
        text: "",
        pageCount: 0,
        pages: [],
        error: "La respuesta del parser no fue JSON válido.",
      }
    }

    return parseDoclingResponse(data)
  } catch (error: any) {
    console.error("[Paper parser] error:", error?.message || error)
    return {
      success: false,
      parser: "external-parser",
      method: "external-parser",
      text: "",
      pageCount: 0,
      pages: [],
      error: error?.message || "Fallo desconocido del parser externo.",
    }
  }
}
