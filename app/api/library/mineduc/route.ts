import { NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"
import type { MineducBook, MineducCatalogResponse } from "@/lib/library/mineduc-types"

const CURRICULUM_BASE = "https://www.curriculumnacional.cl"
const CATALOG_LOGIN = "https://catalogotextos.mineduc.cl/catalogo-textos/login/login"
const PAGE_SIZE = 12
const CACHE_SECONDS = 6 * 60 * 60

const SUBJECTS = [
  "Lengua y Literatura",
  "Lenguaje y Comunicación",
  "Ciencias para la Ciudadanía",
  "Educación Ciudadana",
  "Historia, Geografía y Ciencias Sociales",
  "Ciencias Naturales",
  "Matemática",
  "Física",
  "Química",
  "Biología",
  "Inglés",
  "Filosofía",
  "Tecnología",
  "Música",
  "Artes Visuales",
] as const

function cleanText(value = "") {
  return value.replace(/\s+/g, " ").trim()
}

function absoluteUrl(value?: string | null, base = CURRICULUM_BASE) {
  if (!value) return ""
  try {
    const url = new URL(value, base)
    if (url.protocol !== "https:" && url.protocol !== "http:") return ""
    return url.toString()
  } catch {
    return ""
  }
}

function isOfficialUrl(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase()
    return (
      host === "curriculumnacional.cl" ||
      host.endsWith(".curriculumnacional.cl") ||
      host === "mineduc.cl" ||
      host.endsWith(".mineduc.cl")
    )
  } catch {
    return false
  }
}

function slugId(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100)
}

function inferLevel(text: string) {
  const normalized = cleanText(text)
  const combined = normalized.match(/([1-8])\s*[°ºo]?\s*(?:y|-)\s*([1-8])\s*[°ºo]?\s*B[aá]sico/i)
  if (combined) return `${combined[1]}° y ${combined[2]}° Básico`

  const combinedMiddle = normalized.match(/([1-4])\s*[°ºo]?\s*(?:y|-)\s*([1-4])\s*[°ºo]?\s*Medio/i)
  if (combinedMiddle) return `${combinedMiddle[1]}° y ${combinedMiddle[2]}° Medio`

  const basic = normalized.match(/([1-8])\s*[°ºo]?\s*B[aá]sico/i)
  if (basic) return `${basic[1]}° Básico`

  const middle = normalized.match(/([1-4])\s*[°ºo]?\s*Medio/i)
  if (middle) return `${middle[1]}° Medio`

  const nt = normalized.match(/\b(NT1|NT2)\b/i)
  return nt ? nt[1].toUpperCase() : "Nivel no indicado"
}

function inferSubject(text: string) {
  const normalized = text.toLocaleLowerCase("es-CL")
  return SUBJECTS.find((subject) => normalized.includes(subject.toLocaleLowerCase("es-CL"))) || "Asignatura no indicada"
}

function inferKind(text: string) {
  if (/gu[ií]a\s+(?:digital\s+)?del\s+docente/i.test(text)) return "Guía del Docente"
  if (/cuaderno\s+de\s+actividades/i.test(text)) return "Cuaderno de Actividades"
  if (/texto\s+(?:del|de)\s+estudiante/i.test(text)) return "Texto del Estudiante"
  return "Texto Escolar MINEDUC"
}

function inferYear(text: string) {
  const edition = text.match(/Edici[oó]n\s+(20\d{2})/i)
  if (edition) return edition[1]
  const publication = text.match(/A[nñ]o\s+(?:de\s+)?publicaci[oó]n\s*:?\s*(20\d{2})/i)
  if (publication) return publication[1]
  const visibleYear = text.match(/\b(202[4-9])\b/)
  return visibleYear?.[1] || "Año no indicado"
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "EDUAI-MINEDUC-Library/1.0",
    },
    next: { revalidate: CACHE_SECONDS },
  })
  if (!response.ok) throw new Error(`MINEDUC respondió con estado ${response.status}`)
  return response.text()
}

type Candidate = {
  title: string
  detailUrl: string
  context: string
  coverUrl: string
}

function extractCandidates(html: string, includeAll: boolean) {
  const $ = cheerio.load(html)
  const unique = new Map<string, Candidate>()

  $("a[href]").each((_, element) => {
    const anchor = $(element)
    const title = cleanText(anchor.text())
    if (!title || title.length < 5) return

    const isStudentText = /texto\s+(?:del|de)\s+estudiante/i.test(title)
    const isRelatedBook = /gu[ií]a\s+(?:digital\s+)?del\s+docente|cuaderno\s+de\s+actividades|texto\s+escolar/i.test(title)
    if (!isStudentText && !(includeAll && isRelatedBook)) return

    const detailUrl = absoluteUrl(anchor.attr("href"))
    if (!detailUrl || !isOfficialUrl(detailUrl)) return

    let node = anchor
    let context = title
    for (let depth = 0; depth < 6; depth += 1) {
      const parent = node.parent()
      if (!parent.length) break
      node = parent
      const candidateText = cleanText(node.text())
      if (candidateText.length > context.length) context = candidateText
      if (/Libro\s*-?\s*Textos Escolares MINEDUC/i.test(candidateText)) break
    }

    const container = node
    const image = container.find("img").first()
    const coverUrl = absoluteUrl(image.attr("src") || image.attr("data-src") || "", detailUrl)
    const key = detailUrl.split("#")[0]
    if (!unique.has(key)) unique.set(key, { title, detailUrl: key, context, coverUrl })
  })

  return [...unique.values()]
}

async function enrichCandidate(candidate: Candidate): Promise<MineducBook | null> {
  try {
    const html = await fetchHtml(candidate.detailUrl)
    const $ = cheerio.load(html)
    const mainText = cleanText($("main").text() || $("body").text())

    if (!/Textos Escolares MINEDUC/i.test(mainText) && !/Texto\s+(?:del|de)\s+Estudiante/i.test(mainText)) {
      return null
    }

    const pageTitle = cleanText($("h1").first().text()) || candidate.title
    const combinedText = `${pageTitle} ${candidate.context} ${mainText}`
    let pdfUrl = ""
    let officialReaderUrl = ""

    $("a[href]").each((_, element) => {
      const anchor = $(element)
      const href = absoluteUrl(anchor.attr("href"), candidate.detailUrl)
      if (!href || !isOfficialUrl(href)) return
      const label = cleanText(anchor.text())
      const lowerHref = href.toLowerCase()

      if (
        !pdfUrl &&
        (lowerHref.includes(".pdf") ||
          /descargar\s+(?:el\s+)?recurso|descarga\s+pdf|ver\s+pdf|texto\s+completo/i.test(label))
      ) {
        pdfUrl = href
      }

      if (
        !officialReaderUrl &&
        (/Mi\s+Texto\s+Escolar|Cat[aá]logo\s+de\s+Textos\s+Escolares|Ir\s+al\s+cat[aá]logo/i.test(label) ||
          new URL(href).hostname.includes("catalogotextos.mineduc.cl"))
      ) {
        officialReaderUrl = href
      }
    })

    const imageCandidates = $("main img, article img, .field img")
      .toArray()
      .map((element) => {
        const image = $(element)
        return {
          src: absoluteUrl(image.attr("src") || image.attr("data-src") || "", candidate.detailUrl),
          alt: cleanText(image.attr("alt") || ""),
        }
      })
      .filter((image) => image.src && isOfficialUrl(image.src))

    const cover =
      imageCandidates.find((image) => /portada|texto|estudiante|edici[oó]n/i.test(image.alt))?.src ||
      candidate.coverUrl ||
      imageCandidates[0]?.src ||
      ""

    const detailPath = new URL(candidate.detailUrl).pathname
    const id = `mineduc-${slugId(detailPath || pageTitle)}`

    return {
      id,
      title: pageTitle,
      author: "Ministerio de Educación de Chile",
      year: inferYear(combinedText),
      level: inferLevel(combinedText),
      subject: inferSubject(combinedText),
      kind: inferKind(combinedText),
      source: "MINEDUC",
      coverUrl: cover,
      detailUrl: candidate.detailUrl,
      pdfUrl: pdfUrl || undefined,
      officialReaderUrl: officialReaderUrl || (!pdfUrl ? CATALOG_LOGIN : undefined),
      access: pdfUrl ? "pdf" : "official",
    }
  } catch {
    return {
      id: `mineduc-${slugId(candidate.detailUrl)}`,
      title: candidate.title,
      author: "Ministerio de Educación de Chile",
      year: inferYear(candidate.context),
      level: inferLevel(candidate.context),
      subject: inferSubject(candidate.context),
      kind: inferKind(candidate.context),
      source: "MINEDUC",
      coverUrl: candidate.coverUrl,
      detailUrl: candidate.detailUrl,
      officialReaderUrl: CATALOG_LOGIN,
      access: "official",
    }
  }
}

function extractTotal(html: string, fallback: number) {
  const text = cleanText(cheerio.load(html)("body").text())
  const patterns = [
    /(?:de|un total de)\s+([\d.]+)\s+resultados/i,
    /([\d.]+)\s+resultados/i,
    /Se\s+muestran[^\d]*\d+[^\d]+de\s+([\d.]+)/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return Number(match[1].replaceAll(".", "")) || fallback
  }
  return fallback
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const rawQuery = cleanText(params.get("q") || "")
  const page = Math.max(1, Number(params.get("page") || "1") || 1)
  const includeAll = params.get("include") !== "student"
  const query = rawQuery || (includeAll ? "Texto Escolar MINEDUC" : "Texto del Estudiante")

  const catalogUrl = `${CURRICULUM_BASE}/buscador?search_text=${encodeURIComponent(query)}&page=${page - 1}`

  try {
    const html = await fetchHtml(catalogUrl)
    const candidates = extractCandidates(html, includeAll).slice(0, PAGE_SIZE)
    const enriched = await Promise.all(candidates.map(enrichCandidate))
    const books = enriched.filter((book): book is MineducBook => Boolean(book))
    const upstreamTotal = extractTotal(html, books.length)

    const response: MineducCatalogResponse = {
      books,
      total: upstreamTotal,
      page,
      pageSize: PAGE_SIZE,
      hasMore: candidates.length >= PAGE_SIZE || upstreamTotal > page * PAGE_SIZE,
      source: "MINEDUC / Currículum Nacional",
      catalogUrl,
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400` },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo consultar el catálogo oficial MINEDUC",
        catalogUrl,
        officialLogin: CATALOG_LOGIN,
      },
      { status: 502 },
    )
  }
}
