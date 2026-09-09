import { NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"
import type { FullTextBook, FullTextSearchResponse, FullTextSourceId } from "@/lib/library/fulltext"

const CACHE_SECONDS = 60 * 60 * 6
const DEFAULT_QUERY = "educación"

function clean(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function absoluteUrl(value?: string | null, base?: string) {
  if (!value) return ""
  try {
    const url = new URL(value, base)
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : ""
  } catch {
    return ""
  }
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function matchesQuery(query: string, ...parts: string[]) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  const haystack = normalize(parts.join(" "))
  return tokens.length === 0 || tokens.every((token) => haystack.includes(token))
}

async function fetchJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json", "User-Agent": "EDUAI-FullText-Library/1.0" },
    next: { revalidate: CACHE_SECONDS },
  })
  if (!response.ok) throw new Error(`${new URL(url).hostname} respondió ${response.status}`)
  return response.json() as Promise<unknown>
}

async function fetchHtml(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    signal,
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "EDUAI-FullText-Library/1.0" },
    next: { revalidate: CACHE_SECONDS },
  })
  if (!response.ok) throw new Error(`${new URL(url).hostname} respondió ${response.status}`)
  return response.text()
}

type GoogleVolume = {
  id?: string
  volumeInfo?: {
    title?: string
    authors?: string[]
    publishedDate?: string
    description?: string
    language?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    canonicalVolumeLink?: string
    infoLink?: string
  }
  accessInfo?: {
    viewability?: string
    publicDomain?: boolean
    embeddable?: boolean
    webReaderLink?: string
    accessViewStatus?: string
    pdf?: { isAvailable?: boolean; downloadLink?: string }
    epub?: { isAvailable?: boolean; downloadLink?: string }
  }
}

async function searchGoogleBooks(query: string, signal: AbortSignal): Promise<FullTextBook[]> {
  const params = new URLSearchParams({
    q: query,
    filter: "full",
    printType: "books",
    maxResults: "20",
    orderBy: "relevance",
  })
  const key = process.env.GOOGLE_BOOKS_API_KEY?.trim()
  if (key) params.set("key", key)

  const payload = (await fetchJson(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`, signal)) as { items?: GoogleVolume[] }
  return (payload.items || []).flatMap((item): FullTextBook[] => {
    const info = item.volumeInfo
    const access = item.accessInfo
    if (!item.id || !info?.title || access?.viewability !== "ALL_PAGES") return []
    const sourceUrl = absoluteUrl(access.webReaderLink || info.canonicalVolumeLink || info.infoLink)
    if (!sourceUrl) return []
    const pdfUrl = absoluteUrl(access.pdf?.downloadLink)
    const cover = absoluteUrl(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail).replace(/^http:/, "https:")
    return [{
      id: `google-${item.id}`,
      title: info.title,
      author: info.authors?.slice(0, 3).join(", ") || "Autor no indicado",
      sourceId: "google-books",
      source: "Google Books",
      description: clean(info.description).slice(0, 520) || "Libro con todas las páginas visibles en Google Books.",
      language: info.language?.toUpperCase() || "Idioma no indicado",
      year: info.publishedDate?.slice(0, 4) || "Año no indicado",
      license: access.publicDomain ? "Dominio público" : "Acceso completo autorizado por Google Books",
      complete: true,
      format: pdfUrl ? "PDF / Web" : access.epub?.isAvailable ? "EPUB / Web" : "Web",
      coverUrl: cover,
      sourceUrl,
      readerType: pdfUrl ? "pdf" : access.embeddable ? "google" : "external",
      readerUrl: pdfUrl || (access.embeddable ? `https://books.google.com/books?id=${encodeURIComponent(item.id)}&output=embed` : undefined),
    }]
  })
}

type WikimediaPage = {
  pageid?: number
  title?: string
  fullurl?: string
  extract?: string
  thumbnail?: { source?: string }
}

async function searchWikimedia(query: string, project: "wikisource" | "wikibooks", signal: AbortSignal): Promise<FullTextBook[]> {
  const host = project === "wikisource" ? "es.wikisource.org" : "es.wikibooks.org"
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "0",
    gsrlimit: "14",
    prop: "info|extracts|pageimages",
    inprop: "url",
    exintro: "1",
    explaintext: "1",
    piprop: "thumbnail",
    pithumbsize: "300",
    format: "json",
    origin: "*",
  })
  const payload = (await fetchJson(`https://${host}/w/api.php?${params.toString()}`, signal)) as { query?: { pages?: Record<string, WikimediaPage> } }
  const pages = Object.values(payload.query?.pages || {})

  return pages.flatMap((page): FullTextBook[] => {
    if (!page.pageid || !page.title || !page.fullurl) return []
    return [{
      id: `${project}-${page.pageid}`,
      title: page.title,
      author: "Comunidad Wikimedia",
      sourceId: project,
      source: project === "wikisource" ? "Wikisource" : "Wikibooks",
      description: clean(page.extract).slice(0, 520) || (project === "wikisource" ? "Texto libre disponible en Wikisource." : "Libro de texto libre disponible en Wikibooks."),
      language: "Español",
      year: "Edición vigente",
      license: project === "wikisource" ? "Texto libre / dominio público según la obra" : "Licencia libre Wikimedia",
      complete: true,
      format: project === "wikisource" ? "Texto / EPUB / PDF" : "Texto web",
      coverUrl: absoluteUrl(page.thumbnail?.source),
      sourceUrl: page.fullurl,
      readerType: "wikimedia",
      wikiProject: project,
      wikiTitle: page.title,
    }]
  })
}

function getRecordList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
  if (!payload || typeof payload !== "object") return []
  const object = payload as Record<string, unknown>
  for (const key of ["data", "textbooks", "books", "results", "items"]) {
    const value = object[key]
    if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
  }
  return []
}

function stringValue(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }
  return ""
}

function arrayStrings(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (typeof item === "string") return item
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>
      return stringValue(record, "name", "title", "url", "link", "value", "format")
    }
    return ""
  }).filter(Boolean)
}

function findFormatUrl(record: Record<string, unknown>, wanted: RegExp) {
  const formats = record.formats
  if (!Array.isArray(formats)) return ""
  for (const item of formats) {
    if (!item || typeof item !== "object") continue
    const format = item as Record<string, unknown>
    const label = stringValue(format, "format", "name", "type", "label")
    const url = absoluteUrl(stringValue(format, "url", "link", "download_url"))
    if (url && wanted.test(label)) return url
  }
  return ""
}

async function searchOpenTextbookLibrary(query: string, signal: AbortSignal): Promise<FullTextBook[]> {
  const params = new URLSearchParams({ term: query, order_by: "rating" })
  params.append("formats[]", "PDF")
  params.append("formats[]", "Online")
  params.append("formats[]", "eBook")
  const payload = await fetchJson(`https://open.umn.edu/opentextbooks/textbooks.json?${params.toString()}`, signal)
  const records = getRecordList(payload).slice(0, 20)

  return records.flatMap((record, index): FullTextBook[] => {
    const title = stringValue(record, "title", "name")
    if (!title) return []
    const id = stringValue(record, "id", "textbook_id") || `${index}-${title}`
    const contributors = arrayStrings(record.authors || record.contributors)
    const pdf = findFormatUrl(record, /pdf/i)
    const online = findFormatUrl(record, /online|web|ebook/i)
    const sourceUrl = absoluteUrl(stringValue(record, "url", "link", "permalink")) || online || pdf || `https://open.umn.edu/opentextbooks/books/${encodeURIComponent(id)}`
    const license = stringValue(record, "license", "license_name") || arrayStrings(record.licenses)[0] || "Licencia abierta"
    return [{
      id: `otl-${id}`,
      title,
      author: contributors.join(", ") || stringValue(record, "author", "authors") || "Autor no indicado",
      sourceId: "open-textbook-library",
      source: "Open Textbook Library",
      description: stringValue(record, "description", "abstract", "summary").slice(0, 520) || "Libro de texto abierto y completo.",
      language: stringValue(record, "language", "language_name") || "Idioma no indicado",
      year: stringValue(record, "copyright_year", "year", "publication_year") || "Año no indicado",
      license,
      complete: true,
      format: pdf ? "PDF" : online ? "Web / eBook" : "Libro abierto",
      coverUrl: absoluteUrl(stringValue(record, "cover_url", "cover", "image_url", "image")),
      sourceUrl,
      readerType: pdf ? "pdf" : "external",
      readerUrl: pdf || undefined,
    }]
  })
}

const OPENSTAX_SUBJECTS = ["business", "college-success", "computer-science", "humanities", "math", "nursing", "science", "social-sciences"]

async function searchOpenStax(query: string, signal: AbortSignal): Promise<FullTextBook[]> {
  const pages = await Promise.allSettled(OPENSTAX_SUBJECTS.map((slug) => fetchHtml(`https://openstax.org/subjects/${slug}`, signal)))
  const found = new Map<string, { title: string; url: string }>()

  for (const page of pages) {
    if (page.status !== "fulfilled") continue
    const $ = cheerio.load(page.value)
    $("a[href]").each((_, element) => {
      const anchor = $(element)
      const href = absoluteUrl(anchor.attr("href"), "https://openstax.org")
      if (!href || !/openstax\.org\/(?:details\/books|books)\//i.test(href)) return
      const title = clean(anchor.text())
      if (!title || title.length < 3 || !matchesQuery(query, title)) return
      const match = href.match(/openstax\.org\/(?:details\/books|books)\/([^/?#]+)/i)
      if (!match?.[1]) return
      const slug = decodeURIComponent(match[1])
      found.set(slug, { title, url: `https://openstax.org/details/books/${slug}` })
    })
  }

  return [...found.entries()].slice(0, 20).map(([slug, item]) => ({
    id: `openstax-${slug}`,
    title: item.title,
    author: "OpenStax · Rice University",
    sourceId: "openstax" as FullTextSourceId,
    source: "OpenStax",
    description: "Libro de texto completo de OpenStax, disponible gratuitamente para lectura web y PDF.",
    language: /introducci[oó]n|f[ií]sica|c[aá]lculo|estad[ií]stica|qu[ií]mica|biolog/i.test(normalize(item.title)) ? "Español / según edición" : "Según edición",
    year: "Edición vigente",
    license: "Licencia Creative Commons indicada por OpenStax",
    complete: true,
    format: "Web + PDF",
    coverUrl: "",
    sourceUrl: item.url,
    readerType: "external" as const,
  }))
}

type ScieloCandidate = { title: string; url: string; context: string; cover: string }

async function searchScielo(query: string, signal: AbortSignal): Promise<FullTextBook[]> {
  const params = new URLSearchParams({ q: query, index: "tw", lang: "es", where: "BOOK" })
  params.append("filter[is_comercial_filter][]", "f")
  params.append("filter[files_available][]", "pdf")
  params.append("filter[files_available][]", "epub")
  const searchUrl = `https://books.scielo.org/search/?${params.toString()}`
  const html = await fetchHtml(searchUrl, signal)
  const $ = cheerio.load(html)
  const candidates: ScieloCandidate[] = []

  $("h3").each((_, element) => {
    const heading = $(element)
    const anchor = heading.find("a").first().length ? heading.find("a").first() : heading.parent("a")
    const title = clean(heading.text())
    const url = absoluteUrl(anchor.attr("href") || heading.find("a").attr("href"), searchUrl)
    if (!title || !url || !url.includes("scielo.org")) return
    const container = heading.closest("article, li, .item, .result, div")
    const context = clean(container.text())
    const cover = absoluteUrl(container.find("img").first().attr("src"), searchUrl)
    candidates.push({ title, url, context, cover })
  })

  const unique = [...new Map(candidates.map((item) => [item.url, item])).values()].slice(0, 12)
  const enriched = await Promise.all(unique.map(async (item, index): Promise<FullTextBook> => {
    let pdf = ""
    let epub = ""
    try {
      const detail = cheerio.load(await fetchHtml(item.url, signal))
      detail("a[href]").each((_, element) => {
        const anchor = detail(element)
        const href = absoluteUrl(anchor.attr("href"), item.url)
        const label = clean(anchor.text())
        if (!pdf && href && (/\.pdf(?:$|\?)/i.test(href) || /pdf/i.test(label))) pdf = href
        if (!epub && href && (/\.epub(?:$|\?)/i.test(href) || /epub/i.test(label))) epub = href
      })
    } catch {
      // Keep the official full-text landing page when a direct file cannot be resolved.
    }
    const year = item.context.match(/(?:Año|Ano|Year)\s*:?\s*(20\d{2}|19\d{2})/i)?.[1] || "Año no indicado"
    const author = item.context.match(/(?:Autor|Author|Organizador|Organizer)[^:]*:\s*([^\n]+?)(?:Editora|Publisher|Idioma|Language|Año|Ano|Year|$)/i)?.[1]?.trim() || "Autor no indicado"
    return {
      id: `scielo-${index}-${Buffer.from(item.url).toString("base64url").slice(0, 18)}`,
      title: item.title,
      author,
      sourceId: "scielo",
      source: "SciELO Books",
      description: item.context.slice(0, 520) || "Libro académico de acceso abierto en SciELO Books.",
      language: "Español / Portugués / según edición",
      year,
      license: "Open Access SciELO; licencia indicada en la obra",
      complete: true,
      format: pdf ? "PDF" : epub ? "EPUB" : "Texto completo OA",
      coverUrl: item.cover,
      sourceUrl: item.url,
      readerType: pdf ? "pdf" : "external",
      readerUrl: pdf || epub || undefined,
    }
  }))
  return enriched
}

const SOURCE_PRIORITY: Record<FullTextSourceId, number> = {
  openstax: 100,
  "open-textbook-library": 95,
  wikibooks: 90,
  scielo: 85,
  wikisource: 80,
  "google-books": 70,
}

export async function GET(request: NextRequest) {
  const query = clean(request.nextUrl.searchParams.get("q")).slice(0, 180) || DEFAULT_QUERY
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 18000)

  const tasks: Array<[FullTextSourceId, Promise<FullTextBook[]>]> = [
    ["openstax", searchOpenStax(query, controller.signal)],
    ["open-textbook-library", searchOpenTextbookLibrary(query, controller.signal)],
    ["wikibooks", searchWikimedia(query, "wikibooks", controller.signal)],
    ["scielo", searchScielo(query, controller.signal)],
    ["wikisource", searchWikimedia(query, "wikisource", controller.signal)],
    ["google-books", searchGoogleBooks(query, controller.signal)],
  ]

  try {
    const settled = await Promise.allSettled(tasks.map(([, task]) => task))
    const failedSources: string[] = []
    const books: FullTextBook[] = []
    const sourceCounts: FullTextSearchResponse["sourceCounts"] = {}

    settled.forEach((result, index) => {
      const sourceId = tasks[index][0]
      if (result.status === "fulfilled") {
        const values = result.value.filter((book) => book.complete)
        sourceCounts[sourceId] = values.length
        books.push(...values)
      } else {
        failedSources.push(sourceId)
        sourceCounts[sourceId] = 0
      }
    })

    const seen = new Set<string>()
    const deduped = books
      .sort((a, b) => (SOURCE_PRIORITY[b.sourceId] - SOURCE_PRIORITY[a.sourceId]) || a.title.localeCompare(b.title, "es"))
      .filter((book) => {
        const key = `${normalize(book.title)}:${normalize(book.author)}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 72)

    const response: FullTextSearchResponse = { query, books: deduped, sourceCounts, failedSources }
    return NextResponse.json(response, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400` },
    })
  } finally {
    clearTimeout(timeout)
  }
}
