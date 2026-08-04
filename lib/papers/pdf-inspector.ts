export interface PdfInspectorPage {
  pageNumber: number
  text: string
}

export interface PdfInspectorResult {
  success: boolean
  available: boolean
  method: "pdf-inspector"
  pdfType: string
  confidence: number
  pageCount: number
  pagesNeedingOcr: number[]
  text: string
  markdown: string
  pages: PdfInspectorPage[]
  error?: string
}

function cleanText(value: unknown) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \u00A0]{2,}/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
}

function hasUsefulText(text: string) {
  const clean = cleanText(text)
  if (!clean) return false
  if (clean.length >= 700) return true
  return clean.split(/\s+/).filter(Boolean).length >= 120
}

function pagesFromMarkdown(markdown: string): PdfInspectorPage[] {
  const source = String(markdown || "")
  if (!source.trim()) return []

  const pageMarker = /<!--\s*Page\s+(\d+)\s*-->/gi
  const matches = [...source.matchAll(pageMarker)]

  if (matches.length) {
    const pages: PdfInspectorPage[] = []
    for (let index = 0; index < matches.length; index += 1) {
      const current = matches[index]
      const next = matches[index + 1]
      const pageNumber = Number(current[1] || index + 1)
      const start = (current.index || 0) + current[0].length
      const end = next?.index ?? source.length
      const text = cleanText(source.slice(start, end))
      if (text) pages.push({ pageNumber, text })
    }
    if (pages.length) return pages
  }

  const formFeedPages: PdfInspectorPage[] = source
    .split(/\f/g)
    .map((text, index): PdfInspectorPage => ({
      pageNumber: index + 1,
      text: cleanText(text),
    }))
    .filter((page: PdfInspectorPage) => !!page.text)

  if (formFeedPages.length > 1) return formFeedPages

  const singlePage: PdfInspectorPage = {
    pageNumber: 1,
    text: cleanText(source),
  }

  return singlePage.text ? [singlePage] : []
}

export async function extractWithPdfInspector(buffer: Buffer): Promise<PdfInspectorResult> {
  try {
    const module: any = await import("@firecrawl/pdf-inspector")
    const classifyPdf = module?.classifyPdf
    const processPdf = module?.processPdf

    if (typeof classifyPdf !== "function" || typeof processPdf !== "function") {
      return {
        success: false,
        available: false,
        method: "pdf-inspector",
        pdfType: "Unknown",
        confidence: 0,
        pageCount: 0,
        pagesNeedingOcr: [],
        text: "",
        markdown: "",
        pages: [],
        error: "La instalación de pdf-inspector no expone classifyPdf/processPdf.",
      }
    }

    const classification = classifyPdf(buffer)
    const pdfType = String(classification?.pdfType || "Unknown")
    const pageCount = Number(classification?.pageCount || 0)
    const confidence = Number(classification?.confidence || 0)
    const pagesNeedingOcr = Array.isArray(classification?.pagesNeedingOcr)
      ? classification.pagesNeedingOcr
          .map((page: unknown) => Number(page) + 1)
          .filter((page: number) => Number.isFinite(page) && page > 0)
      : []

    if (pdfType === "Scanned" || pdfType === "ImageBased") {
      return {
        success: false,
        available: true,
        method: "pdf-inspector",
        pdfType,
        confidence,
        pageCount,
        pagesNeedingOcr,
        text: "",
        markdown: "",
        pages: [],
      }
    }

    let processed: any
    try {
      processed = processPdf(buffer, {
        profile: "compact",
        includePageMarkers: true,
      })
    } catch {
      processed = processPdf(buffer)
    }

    const markdown = cleanText(processed?.markdown || processed?.text || "")
    const pages: PdfInspectorPage[] = Array.isArray(processed?.pages)
      ? processed.pages
          .map((page: any, index: number): PdfInspectorPage => ({
            pageNumber: Number(page?.pageNumber || page?.page || index + 1),
            text: cleanText(page?.markdown || page?.text || ""),
          }))
          .filter((page: PdfInspectorPage) => !!page.text)
      : pagesFromMarkdown(markdown)

    const text = cleanText(
      pages.length
        ? pages.map((page: PdfInspectorPage) => page.text).join("\n\n\f\n\n")
        : markdown
    )

    return {
      success: hasUsefulText(text),
      available: true,
      method: "pdf-inspector",
      pdfType,
      confidence,
      pageCount: Number(processed?.pageCount || pageCount || pages.length || 0),
      pagesNeedingOcr,
      text,
      markdown,
      pages,
    }
  } catch (error: any) {
    console.error("[Paper] pdf-inspector failed:", error)
    return {
      success: false,
      available: false,
      method: "pdf-inspector",
      pdfType: "Unknown",
      confidence: 0,
      pageCount: 0,
      pagesNeedingOcr: [],
      text: "",
      markdown: "",
      pages: [],
      error: error?.message || "No se pudo cargar pdf-inspector.",
    }
  }
}
