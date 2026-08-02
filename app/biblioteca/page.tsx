"use client"

// Library reader safety patch v1
// Library catalog retry patch v1

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import {
  ArrowLeft,
  BookCopy,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Globe2,
  Heart,
  LibraryBig,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import LibraryReader from "@/components/library/LibraryReader"
import {
  LIBRARY_COLLECTIONS,
  LIBRARY_SOURCES,
  LibraryBook,
  LibraryCollection,
  ReadingProgress,
  libraryStorageKeys,
  searchOpenLibrary,
} from "@/lib/library/catalog"

type FavoriteMap = Record<string, LibraryBook>
type ProgressMap = Record<string, ReadingProgress>
type AgentStage = "idle" | "catalogs" | "web" | "educational" | "done" | "error"
type DiscoveryAccess = "full" | "borrow" | "preview" | "official" | "reference"

type DiscoveryLink = {
  id: string
  title: string
  url: string
  snippet: string
  source: string
  access: DiscoveryAccess
  trusted: boolean
}

type EducationalAgentResult = {
  query: string
  books: LibraryBook[]
  links: DiscoveryLink[]
  brief: string
  hasLegalReading: boolean
  provider?: string
}

type WebSearchResponse = {
  results?: Array<{ title?: string; url?: string; snippet?: string; score?: number }>
  provider?: string | null
}

type GoogleVolume = {
  id?: string
  volumeInfo?: {
    title?: string
    authors?: string[]
    publishedDate?: string
    description?: string
    language?: string
    categories?: string[]
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    previewLink?: string
    infoLink?: string
  }
  accessInfo?: {
    viewability?: string
    embeddable?: boolean
    publicDomain?: boolean
    webReaderLink?: string
    accessViewStatus?: string
  }
}

const TRUSTED_SOURCE_RULES: Array<{
  match: (hostname: string) => boolean
  source: string
  access: DiscoveryAccess
}> = [
  { match: (host) => host === "openlibrary.org" || host.endsWith(".openlibrary.org"), source: "Open Library", access: "official" },
  { match: (host) => host === "archive.org" || host.endsWith(".archive.org"), source: "Internet Archive", access: "official" },
  { match: (host) => host.includes("books.google."), source: "Google Books", access: "preview" },
  { match: (host) => host === "bpdigital.cl" || host.endsWith(".bpdigital.cl"), source: "BPDigital Chile", access: "borrow" },
  { match: (host) => host === "booknet.com" || host.endsWith(".booknet.com"), source: "Booknet", access: "official" },
  { match: (host) => host === "ellibrototal.com" || host.endsWith(".ellibrototal.com"), source: "El Libro Total", access: "full" },
  { match: (host) => host === "casadellibro.com" || host.endsWith(".casadellibro.com"), source: "Casa del Libro", access: "preview" },
  { match: (host) => host === "gutenberg.org" || host.endsWith(".gutenberg.org"), source: "Project Gutenberg", access: "full" },
  { match: (host) => host.endsWith("wikisource.org"), source: "Wikisource", access: "full" },
]

const AGENT_STAGES: Array<{ id: Exclude<AgentStage, "idle" | "error">; label: string }> = [
  { id: "catalogs", label: "Catálogos" },
  { id: "web", label: "Web legal" },
  { id: "educational", label: "Apoyo educativo" },
  { id: "done", label: "Resultado" },
]

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "") as T
  } catch {
    return fallback
  }
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function safeUrl(value?: string) {
  if (!value) return ""
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : ""
  } catch {
    return ""
  }
}

function classifyDiscoveryUrl(value: string) {
  const url = safeUrl(value)
  if (!url) return { source: "Referencia web", access: "reference" as DiscoveryAccess, trusted: false }
  const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "")
  const rule = TRUSTED_SOURCE_RULES.find((candidate) => candidate.match(hostname))
  return rule
    ? { source: rule.source, access: rule.access, trusted: true }
    : { source: hostname, access: "reference" as DiscoveryAccess, trusted: false }
}

function dedupeBooks(books: LibraryBook[]) {
  const seen = new Set<string>()
  return books.filter((book) => {
    const key = `${normalize(book.title)}:${normalize(book.author)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function rankBooks(query: string, books: LibraryBook[]) {
  const target = normalize(query)
  return [...books].sort((a, b) => {
    const score = (book: LibraryBook) => {
      const title = normalize(book.title)
      if (title === target) return 100
      if (title.startsWith(target)) return 70
      if (title.includes(target)) return 50
      return book.accessMode === "eduai" ? 15 : book.accessMode === "borrow" ? 10 : 0
    }
    return score(b) - score(a)
  })
}

async function searchGoogleBooks(query: string, signal: AbortSignal) {
  const params = new URLSearchParams({
    q: query,
    langRestrict: "es",
    printType: "books",
    orderBy: "relevance",
    maxResults: "12",
  })
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  })
  if (!response.ok) throw new Error("Google Books no respondió")
  const data = (await response.json()) as { items?: GoogleVolume[] }

  return (data.items || []).flatMap((item): LibraryBook[] => {
    const volume = item.volumeInfo
    if (!item.id || !volume?.title) return []
    const access = item.accessInfo || {}
    const viewability = `${access.viewability || ""} ${access.accessViewStatus || ""}`.toUpperCase()
    const full = Boolean(access.publicDomain || viewability.includes("ALL_PAGES") || viewability.includes("FULL_PUBLIC_DOMAIN"))
    const preview = Boolean(access.embeddable || viewability.includes("PARTIAL") || viewability.includes("SAMPLE"))
    const sourceUrl = safeUrl(access.webReaderLink || volume.previewLink || volume.infoLink)
    if (!sourceUrl) return []

    const cover = (volume.imageLinks?.thumbnail || volume.imageLinks?.smallThumbnail || "https://openlibrary.org/images/icons/avatar_book-sm.png")
      .replace(/^http:\/\//, "https://")
      .replace("zoom=1", "zoom=2")

    return [{
      id: `google-${item.id}`,
      title: volume.title,
      author: volume.authors?.slice(0, 2).join(", ") || "Autor no identificado",
      year: volume.publishedDate?.slice(0, 4) || "Fecha no indicada",
      language: volume.language === "es" ? "Español" : volume.language?.toUpperCase() || "Idioma no indicado",
      category: volume.categories?.[0] || "Literatura",
      source: "Google Books",
      rights: full ? "Lectura completa oficial" : preview ? "Vista previa oficial" : "Ficha y disponibilidad",
      cover,
      description: volume.description?.slice(0, 650) || "Consulta la ficha y la disponibilidad autorizada en Google Books.",
      accessMode: full ? "external" : preview ? "preview" : "external",
      sourceUrl,
    }]
  })
}

async function searchTrustedWeb(query: string, signal: AbortSignal) {
  const domains = [
    "openlibrary.org",
    "books.google.com",
    "bpdigital.cl",
    "booknet.com/es",
    "ellibrototal.com",
    "casadellibro.com",
    "gutenberg.org",
    "es.wikisource.org",
  ]
  const webQuery = `\"${query}\" libro leer online préstamo vista previa (${domains.map((domain) => `site:${domain}`).join(" OR ")})`
  const response = await fetch("/api/web/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ query: webQuery }),
  })
  if (!response.ok) throw new Error("La búsqueda web no respondió")
  const data = (await response.json()) as WebSearchResponse

  const links = (data.results || []).flatMap((item, index): DiscoveryLink[] => {
    const url = safeUrl(item.url)
    if (!url) return []
    const classification = classifyDiscoveryUrl(url)
    if (!classification.trusted && url.toLowerCase().includes(".pdf")) return []
    return [{
      id: `${classification.source}-${index}-${url}`,
      title: item.title?.trim() || query,
      url,
      snippet: item.snippet?.trim().slice(0, 420) || "Consulta esta referencia para verificar disponibilidad y edición.",
      source: classification.source,
      access: classification.access,
      trusted: classification.trusted,
    }]
  })

  const unique = new Map<string, DiscoveryLink>()
  for (const link of links) {
    const key = new URL(link.url).hostname.replace(/^www\./, "")
    if (!unique.has(key) || (link.trusted && !unique.get(key)?.trusted)) unique.set(key, link)
  }

  return {
    links: [...unique.values()]
      .sort((a, b) => Number(b.trusted) - Number(a.trusted))
      .slice(0, 10),
    provider: data.provider || undefined,
  }
}

async function createEducationalBrief(query: string, books: LibraryBook[], links: DiscoveryLink[], signal: AbortSignal) {
  const findings = {
    books: books.slice(0, 8).map((book) => ({ title: book.title, author: book.author, year: book.year, source: book.source, access: book.rights, url: book.sourceUrl })),
    links: links.slice(0, 8).map((link) => ({ title: link.title, source: link.source, access: link.access, url: link.url, snippet: link.snippet })),
  }

  const response = await fetch("/api/superagent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      messages: [{
        role: "user",
        content: [`Búsqueda solicitada: ${query}`, `Hallazgos verificados:\n${JSON.stringify(findings, null, 2)}`, "Prepara una solución educativa útil aunque no exista lectura completa legal disponible."].join("\n\n"),
      }],
      task: "reasoning",
      maxTokens: 1800,
      skipTools: true,
      systemPrompt: `Eres el Agente Bibliotecario EDUAI. Responde en español y en Markdown.
Tu misión es resolver una búsqueda educativa de libros sin infringir derechos de autor.

Reglas obligatorias:
1. Usa los hallazgos entregados para informar disponibilidad. No inventes enlaces, ediciones ni accesos.
2. Solo considera lectura completa cuando la fuente indique dominio público, licencia abierta o acceso oficial completo.
3. No reproduzcas capítulos ni fragmentos extensos de obras protegidas.
4. Si no hay lectura completa legal, entrega un resumen extendido original, no sustitutivo del libro.
5. Distingue claramente entre lectura completa, préstamo, vista previa, compra y referencia.
6. Incluye una sección "Dónde encontrarlo legalmente" usando únicamente las fuentes entregadas.
7. Si el título es ambiguo o faltan datos, dilo expresamente.

Estructura:
# Resultado de la búsqueda
## Disponibilidad encontrada
## Resumen extendido
## Personajes o conceptos centrales
## Temas y aprendizajes
## Uso educativo
Incluye 5 preguntas de comprensión y 2 actividades breves.
## Dónde encontrarlo legalmente
## Referencias consultadas`,
      context: { page: "Biblioteca EDUAI", pageMode: "agente-bibliotecario", subject: "Lenguaje y Literatura" },
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success || !data.text) throw new Error(data.error || "No se pudo crear el apoyo educativo")
  return String(data.text)
}

function accessStyles(book: LibraryBook) {
  if (book.accessMode === "eduai") return { label: "Leer completo", badge: "Lectura completa", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
  if (book.accessMode === "borrow") return { label: "Solicitar préstamo", badge: "Préstamo digital", className: "border-blue-200 bg-blue-50 text-blue-700" }
  if (book.accessMode === "preview") return { label: "Abrir vista previa", badge: "Vista previa", className: "border-amber-200 bg-amber-50 text-amber-700" }
  return { label: "Ver disponibilidad", badge: "Acceso oficial", className: "border-violet-200 bg-violet-50 text-violet-700" }
}

function discoveryAccessLabel(access: DiscoveryAccess) {
  if (access === "full") return "Lectura completa"
  if (access === "borrow") return "Préstamo"
  if (access === "preview") return "Vista previa"
  if (access === "official") return "Fuente oficial"
  return "Referencia web"
}

function BookCard({ book, favorite, progress, onOpen, onFavorite }: { book: LibraryBook; favorite: boolean; progress?: ReadingProgress; onOpen: () => void; onFavorite: () => void }) {
  const access = accessStyles(book)
  const percent = progress?.totalPages ? Math.round(((progress.page + 1) / progress.totalPages) * 100) : 0
  return (
    <article className="group min-w-0">
      <button onClick={onOpen} className="relative block aspect-[2/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
        <img src={book.cover} alt={`Portada de ${book.title}`} loading="lazy" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/5 to-transparent opacity-60 transition group-hover:opacity-80" />
        <div className={`absolute left-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-bold shadow-sm backdrop-blur ${access.className}`}>{access.badge}</div>
        <div className="absolute bottom-3 left-3 right-3 translate-y-2 rounded-xl bg-white/95 px-3 py-2 text-center text-xs font-bold text-slate-900 opacity-0 shadow-lg backdrop-blur transition group-hover:translate-y-0 group-hover:opacity-100">{access.label}</div>
        {progress && <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/40"><div className="h-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${Math.min(100, percent)}%` }} /></div>}
      </button>
      <div className="mt-3 flex items-start gap-2">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left"><h3 className="line-clamp-2 text-sm font-bold leading-5 text-slate-900 transition group-hover:text-blue-700">{book.title}</h3><p className="mt-1 truncate text-xs text-slate-500">{book.author}</p><p className="mt-1 truncate text-[11px] font-medium text-slate-400">{book.year} · {book.category}</p></button>
        <button onClick={onFavorite} className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border transition ${favorite ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:text-rose-500"}`} aria-label={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}><Heart size={15} fill={favorite ? "currentColor" : "none"} /></button>
      </div>
    </article>
  )
}

function CollectionButton({ collection, active, onClick }: { collection: LibraryCollection; active: boolean; onClick: () => void }) {
  const Icon = collection.id === "favorites" ? Heart : collection.id === "reading" ? Bookmark : collection.id === "latest" ? Clock3 : BookOpen
  return <button onClick={onClick} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${active ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><span className="flex items-center gap-2.5"><Icon size={15} />{collection.label}</span>{active && <ChevronRight size={15} />}</button>
}

function AgentPanel({ stage, result, error, onOpenBook, onRetry }: { stage: AgentStage; result: EducationalAgentResult | null; error: string; onOpenBook: (book: LibraryBook) => void; onRetry: () => void }) {
  if (stage === "idle") return null
  const stageIndex = AGENT_STAGES.findIndex((item) => item.id === stage)
  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 via-white to-blue-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-500/20">{stage === "done" ? <CheckCircle2 size={21} /> : stage === "error" ? <Globe2 size={21} /> : <Loader2 size={21} className="animate-spin" />}</div><div><h2 className="text-base font-bold text-slate-950">Agente Bibliotecario EDUAI</h2><p className="mt-1 text-xs leading-5 text-slate-500">{stage === "catalogs" && "Buscando el título en catálogos bibliográficos y lectores oficiales..."}{stage === "web" && "Revisando bibliotecas, préstamos, vistas previas y fuentes legales en la web..."}{stage === "educational" && "Preparando una solución educativa con resumen, preguntas y actividades..."}{stage === "done" && `Búsqueda resuelta para “${result?.query || "el libro solicitado"}”.`}{stage === "error" && "No fue posible terminar toda la búsqueda."}</p></div></div>
        <div className="flex flex-wrap gap-2">{AGENT_STAGES.map((item, index) => { const complete = stage === "done" || (stage !== "error" && stageIndex >= index); return <span key={item.id} className={`rounded-full border px-3 py-1 text-[10px] font-bold ${complete ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-400"}`}>{item.label}</span> })}</div>
      </div>
      {stage === "error" ? <div className="px-6 py-10 text-center"><p className="text-sm text-slate-600">{error}</p><button onClick={onRetry} className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white">Reintentar búsqueda</button></div> : !result ? <div className="grid gap-3 p-5 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</div> : (
        <div className="p-5 sm:p-6">
          <div className={`rounded-2xl border p-4 ${result.hasLegalReading ? "border-emerald-100 bg-emerald-50" : "border-amber-100 bg-amber-50"}`}><div className="flex items-start gap-3"><ShieldCheck size={19} className={result.hasLegalReading ? "mt-0.5 text-emerald-600" : "mt-0.5 text-amber-600"} /><div><p className={`text-sm font-bold ${result.hasLegalReading ? "text-emerald-950" : "text-amber-950"}`}>{result.hasLegalReading ? "Encontramos opciones legales de acceso" : "No encontramos una copia completa autorizada"}</p><p className={`mt-1 text-xs leading-5 ${result.hasLegalReading ? "text-emerald-800" : "text-amber-800"}`}>{result.hasLegalReading ? "EDUAI distingue entre lectura completa, préstamo, vista previa y ficha oficial antes de abrir una fuente." : "El agente no entrega PDFs desconocidos. En su lugar, preparó un apoyo educativo extendido y referencias para localizar la obra legalmente."}</p></div></div></div>
          {result.books.length > 0 && <div className="mt-6"><h3 className="text-sm font-bold text-slate-950">Coincidencias en catálogos</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{result.books.slice(0, 8).map((book) => { const access = accessStyles(book); return <button key={book.id} onClick={() => onOpenBook(book)} className="group flex min-w-0 gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:shadow-md"><div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100"><img src={book.cover} alt="" className="h-full w-full object-cover" /></div><div className="min-w-0 py-1"><p className="line-clamp-2 text-xs font-bold leading-5 text-slate-900 group-hover:text-blue-700">{book.title}</p><p className="mt-1 truncate text-[11px] text-slate-500">{book.author}</p><span className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[9px] font-bold ${access.className}`}>{access.badge}</span></div></button> })}</div></div>}
          {result.links.length > 0 && <div className="mt-7"><h3 className="text-sm font-bold text-slate-950">Dónde buscar, leer o solicitarlo</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{result.links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-violet-200 hover:bg-white hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[9px] font-bold ${link.trusted ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}>{link.source}</span><span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700">{discoveryAccessLabel(link.access)}</span></div><p className="mt-2 line-clamp-2 text-sm font-bold text-slate-900 group-hover:text-violet-700">{link.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{link.snippet}</p></div><ExternalLink size={15} className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-violet-600" /></div></a>)}</div></div>}
          <div className="mt-7 rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-7"><div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm"><Bot size={19} /></div><div><h3 className="text-sm font-bold text-slate-950">Solución educativa</h3><p className="text-xs text-slate-500">Resumen extendido, comprensión y actividades sin sustituir ilegalmente la obra.</p></div></div><article className="prose prose-slate max-w-none prose-headings:font-bold prose-a:text-blue-700 prose-li:my-1 prose-p:leading-7"><ReactMarkdown>{result.brief}</ReactMarkdown></article></div>
        </div>
      )}
    </section>
  )
}

export default function BibliotecaPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const searchControllerRef = useRef<AbortController | null>(null)
  const agentControllerRef = useRef<AbortController | null>(null)
  const [displayName, setDisplayName] = useState("Usuario")
  const [userId, setUserId] = useState<string | null>(null)
  const [activeCollectionId, setActiveCollectionId] = useState("latest")
  const [searchDraft, setSearchDraft] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [remoteBooks, setRemoteBooks] = useState<LibraryBook[]>([])
  const [remoteTotal, setRemoteTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState("")
  const [catalogReload, setCatalogReload] = useState(0)
  const [favorites, setFavorites] = useState<FavoriteMap>({})
  const [progress, setProgress] = useState<ProgressMap>({})
  const [activeBook, setActiveBook] = useState<LibraryBook | null>(null)
  const [agentStage, setAgentStage] = useState<AgentStage>("idle")
  const [agentResult, setAgentResult] = useState<EducationalAgentResult | null>(null)
  const [agentError, setAgentError] = useState("")
  const activeCollection = useMemo(() => LIBRARY_COLLECTIONS.find((collection) => collection.id === activeCollectionId) || LIBRARY_COLLECTIONS[0], [activeCollectionId])
  const storageKeys = useMemo(() => (userId ? libraryStorageKeys(userId) : null), [userId])

  useEffect(() => { const initialize = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.push("/login"); return }; setUserId(user.id); setDisplayName(user.user_metadata?.name || user.email?.split("@")[0] || "Usuario") }; initialize() }, [router, supabase])
  useEffect(() => { if (!storageKeys) return; setFavorites(readJson<FavoriteMap>(storageKeys.favorites, {})); setProgress(readJson<ProgressMap>(storageKeys.progress, {})) }, [storageKeys])
  useEffect(() => {
    if (activeCollection.local) { setLoading(false); setCatalogError(""); return }
    searchControllerRef.current?.abort()
    const controller = new AbortController()
    searchControllerRef.current = controller
    setLoading(true)
    setCatalogError("")
    searchOpenLibrary({ collection: activeCollection, search: searchTerm, page, signal: controller.signal })
      .then(({ books, total }) => { if (controller.signal.aborted) return; setRemoteBooks(books); setRemoteTotal(total) })
      .catch((error) => { if (controller.signal.aborted) return; setRemoteBooks([]); setRemoteTotal(0); setCatalogError(error instanceof Error ? error.message : "No se pudo cargar el catálogo") })
      .finally(() => { if (searchControllerRef.current === controller) { searchControllerRef.current = null; setLoading(false) } })
    return () => controller.abort()
  }, [activeCollection, catalogReload, page, searchTerm])
  useEffect(() => () => agentControllerRef.current?.abort(), [])

  const visibleBooks = useMemo(() => { if (activeCollection.local === "favorites") return Object.values(favorites); if (activeCollection.local === "reading") return Object.values(progress).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((entry) => entry.book); return remoteBooks }, [activeCollection.local, favorites, progress, remoteBooks])
  const visibleTotal = activeCollection.local ? visibleBooks.length : remoteTotal

  const runEducationalAgent = useCallback(async (query: string) => {
    const cleanQuery = query.trim()
    if (!cleanQuery) return
    agentControllerRef.current?.abort()
    const controller = new AbortController()
    agentControllerRef.current = controller
    setAgentStage("catalogs")
    setAgentError("")
    setAgentResult(null)
    try {
      const defaultCollection = LIBRARY_COLLECTIONS.find((collection) => collection.id === "latest") || LIBRARY_COLLECTIONS[0]
      const [openLibraryResult, googleResult] = await Promise.allSettled([searchOpenLibrary({ collection: defaultCollection, search: cleanQuery, page: 1, signal: controller.signal }), searchGoogleBooks(cleanQuery, controller.signal)])
      if (controller.signal.aborted) return
      const openLibraryBooks = openLibraryResult.status === "fulfilled" ? openLibraryResult.value.books : []
      const googleBooks = googleResult.status === "fulfilled" ? googleResult.value : []
      const books = rankBooks(cleanQuery, dedupeBooks([...openLibraryBooks, ...googleBooks])).slice(0, 12)
      setAgentStage("web")
      let links: DiscoveryLink[] = []
      let provider: string | undefined
      try { const webResult = await searchTrustedWeb(cleanQuery, controller.signal); links = webResult.links; provider = webResult.provider } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return }
      if (controller.signal.aborted) return
      setAgentStage("educational")
      const brief = await createEducationalBrief(cleanQuery, books, links, controller.signal)
      if (controller.signal.aborted) return
      const hasLegalReading = books.some((book) => ["eduai", "borrow", "preview"].includes(book.accessMode)) || links.some((link) => ["full", "borrow", "preview"].includes(link.access))
      setAgentResult({ query: cleanQuery, books, links, brief, hasLegalReading, provider })
      setAgentStage("done")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setAgentError(error instanceof Error ? error.message : "No se pudo completar la búsqueda educativa")
      setAgentStage("error")
    } finally { if (agentControllerRef.current === controller) agentControllerRef.current = null }
  }, [])

  const changeCollection = (collectionId: string) => { setActiveCollectionId(collectionId); setPage(1); setSearchTerm(""); setSearchDraft("") }
  const submitSearch = (event: FormEvent) => { event.preventDefault(); const query = searchDraft.trim(); if (!query) return; if (activeCollection.local) setActiveCollectionId("latest"); setSearchTerm(query); setPage(1); void runEducationalAgent(query) }
  const searchExample = (query: string) => { setSearchDraft(query); setSearchTerm(query); setActiveCollectionId("latest"); setPage(1); void runEducationalAgent(query) }
  const toggleFavorite = (book: LibraryBook) => { if (!storageKeys) return; setFavorites((current) => { const next = { ...current }; if (next[book.id]) delete next[book.id]; else next[book.id] = book; localStorage.setItem(storageKeys.favorites, JSON.stringify(next)); return next }) }
  const handleProgress = useCallback((readingProgress: ReadingProgress) => { if (!storageKeys) return; setProgress((current) => { const next = { ...current, [readingProgress.book.id]: readingProgress }; localStorage.setItem(storageKeys.progress, JSON.stringify(next)); return next }) }, [storageKeys])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl"><div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><Link href="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" aria-label="Volver al panel"><ArrowLeft size={18} /></Link><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20"><LibraryBig size={20} /></div><div className="min-w-0"><h1 className="truncate text-base font-bold">Biblioteca EDUAI</h1><p className="hidden truncate text-xs text-slate-500 sm:block">Encuentra el libro o recibe una solución educativa completa</p></div></div><div className="flex items-center gap-2 sm:gap-3"><div className="hidden items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 md:flex"><ShieldCheck size={14} /> Acceso legal verificado</div><span className="max-w-28 truncate text-sm text-slate-600 sm:max-w-none">{displayName}</span></div></div></header>
      <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:flex-col"><div className="border-b border-slate-100 px-5 py-5"><p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Colecciones</p><div className="space-y-1">{LIBRARY_COLLECTIONS.map((collection) => <CollectionButton key={collection.id} collection={collection} active={collection.id === activeCollectionId} onClick={() => changeCollection(collection.id)} />)}</div></div><div className="p-5"><div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50 p-4"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><Bot size={18} /></div><h2 className="text-sm font-bold text-slate-900">Agente de búsqueda educativa</h2><p className="mt-1 text-xs leading-5 text-slate-600">Busca el libro, valida el acceso y crea una guía cuando la obra no está disponible legalmente.</p></div><div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Política de acceso</p><p className="mt-2 text-xs leading-5 text-slate-600">EDUAI no entrega copias desconocidas de obras protegidas. Prioriza lectura abierta, préstamo, muestra y fuentes oficiales.</p></div></div></aside>
        <main className="min-w-0 px-4 py-6 sm:px-7 lg:px-9 lg:py-8"><section className="mx-auto max-w-[1580px]">
          <div className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm"><div className="grid gap-7 bg-gradient-to-br from-blue-50 via-white to-violet-50 px-5 py-7 md:grid-cols-[minmax(0,1fr)_auto] md:px-8 md:py-9"><div><div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold text-blue-700 shadow-sm"><Sparkles size={13} /> Biblioteca y agente educativo</div><h2 className="mt-4 max-w-4xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Busca cualquier libro. EDUAI intentará encontrarlo y ayudarte a estudiarlo.</h2><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">Primero revisa catálogos, préstamos y vistas previas oficiales. Si no existe lectura completa autorizada, entrega un resumen extendido, preguntas, actividades y referencias legales.</p></div><div className="hidden items-center justify-center md:flex"><div className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-xl shadow-blue-500/20"><BookOpenCheck size={50} /></div></div></div><form onSubmit={submitSearch} className="border-t border-slate-100 p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Ejemplo: El caballero de la armadura oxidada" className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" /></div><button type="submit" disabled={agentStage === "catalogs" || agentStage === "web" || agentStage === "educational"} className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:brightness-105 disabled:opacity-60">{agentStage === "catalogs" || agentStage === "web" || agentStage === "educational" ? <Loader2 size={17} className="animate-spin" /> : <Bot size={17} />} Buscar con el agente</button></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>Prueba:</span>{["El caballero de la armadura oxidada", "Subterra", "La Odisea"].map((example) => <button key={example} type="button" onClick={() => searchExample(example)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-700">{example}</button>)}</div></form></div>
          <AgentPanel stage={agentStage} result={agentResult} error={agentError} onOpenBook={setActiveBook} onRetry={() => void runEducationalAgent(searchDraft || searchTerm)} />
          <div className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:hidden">{LIBRARY_COLLECTIONS.map((collection) => <button key={collection.id} onClick={() => changeCollection(collection.id)} className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold ${collection.id === activeCollectionId ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}>{collection.label}</button>)}</div>
          <section className="mt-8"><div className="mb-4 flex items-end justify-between gap-4"><div><div className="flex items-center gap-2"><Globe2 size={18} className="text-blue-600" /><h2 className="text-lg font-bold text-slate-950">Bibliotecas y plataformas conectadas</h2></div><p className="mt-1 text-xs leading-5 text-slate-500">Acceso directo a catálogos abiertos, préstamos chilenos, literatura actual y novedades editoriales.</p></div><span className="hidden rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 sm:inline-flex">6 fuentes verificadas</span></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{LIBRARY_SOURCES.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"><div className={`h-1.5 bg-gradient-to-r ${source.accent}`} /><div className="flex gap-4 p-4"><div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${source.accent} text-white shadow-sm`}><BookCopy size={20} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="truncate text-sm font-bold text-slate-900">{source.name}</h3><ExternalLink size={14} className="flex-shrink-0 text-slate-400 transition group-hover:text-blue-600" /></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{source.description}</p><span className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">{source.access}</span></div></div></a>)}</div></section>
          <section className="mt-9"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="text-xl font-bold text-slate-950">{searchTerm ? `Resultados para “${searchTerm}”` : activeCollection.label}</h2>{!activeCollection.local && <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Open Library en vivo</span>}</div><p className="mt-1 text-xs leading-5 text-slate-500">{activeCollection.description} · {visibleTotal.toLocaleString("es-CL")} resultados</p></div><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"><Zap size={14} className="text-violet-600" /> Selecciona una portada para abrir el visor</div></div>
            {loading ? <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">{Array.from({ length: 12 }).map((_, index) => <div key={index} className="animate-pulse"><div className="aspect-[2/3] rounded-2xl bg-slate-200" /><div className="mt-3 h-4 rounded bg-slate-200" /><div className="mt-2 h-3 w-2/3 rounded bg-slate-100" /></div>)}</div> : catalogError ? <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-12 text-center"><Globe2 size={34} className="mx-auto text-amber-500" /><h3 className="mt-4 text-lg font-bold text-amber-950">El catálogo externo no respondió</h3><p className="mt-2 text-sm text-amber-800">{catalogError}. Las plataformas oficiales de la sección superior siguen disponibles.</p><button onClick={() => setCatalogReload((value) => value + 1)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-bold text-white"><Loader2 size={14} /> Reintentar</button></div> : visibleBooks.length > 0 ? <><div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">{visibleBooks.map((book) => <BookCard key={book.id} book={book} favorite={Boolean(favorites[book.id])} progress={progress[book.id]} onOpen={() => setActiveBook(book)} onFavorite={() => toggleFavorite(book)} />)}</div>{!activeCollection.local && <div className="mt-9 flex items-center justify-center gap-3"><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm disabled:opacity-40"><ChevronLeft size={15} /> Anterior</button><span className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600">Página {page}</span><button onClick={() => setPage((value) => value + 1)} disabled={visibleBooks.length < 30} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm disabled:opacity-40">Siguiente <ChevronRight size={15} /></button></div>}</> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><Search size={34} className="mx-auto text-slate-300" /><h3 className="mt-4 text-lg font-bold">No encontramos libros en esta colección</h3><p className="mt-1 text-sm text-slate-500">El Agente Bibliotecario puede ampliar la búsqueda y preparar una solución educativa.</p></div>}
          </section>
          <footer className="mt-12 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><CheckCircle2 size={20} className="mt-0.5 flex-shrink-0 text-emerald-600" /><div><p className="text-sm font-bold text-slate-900">Búsqueda educativa, legal y transparente</p><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">EDUAI busca el acceso más útil disponible y, cuando no existe una copia completa autorizada, transforma la búsqueda en una experiencia de aprendizaje.</p></div></div><a href="https://openlibrary.org/developers" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 hover:underline"><ExternalLink size={13} /> Datos de Open Library</a></div></footer>
        </section></main>
      </div>
      {activeBook && userId && <LibraryReader book={activeBook} userId={userId} onClose={() => setActiveBook(null)} onProgress={handleProgress} />}
    </div>
  )
}
