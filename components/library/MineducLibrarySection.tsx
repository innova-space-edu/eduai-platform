"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BookOpenCheck, ChevronLeft, ChevronRight, ExternalLink, Loader2, Search, ShieldCheck } from "lucide-react"
import MineducPdfReader from "@/components/library/MineducPdfReader"
import type { MineducBook, MineducCatalogResponse } from "@/lib/library/mineduc-types"

type Props = {
  query?: string
}

const DEFAULT_QUERY = "Texto Escolar MINEDUC"

function coverFallback(book: MineducBook) {
  const initials = book.subject === "Asignatura no indicada" ? "MINEDUC" : book.subject
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-red-50 via-white to-blue-50 p-4 text-center">
      <div className="rounded-full border border-red-100 bg-white px-3 py-1 text-[10px] font-black tracking-wider text-red-700">MINEDUC</div>
      <p className="mt-5 line-clamp-4 text-sm font-bold leading-5 text-slate-800">{book.title}</p>
      <p className="mt-3 text-[11px] font-semibold text-slate-500">{initials}</p>
    </div>
  )
}

export default function MineducLibrarySection({ query = "" }: Props) {
  const controllerRef = useRef<AbortController | null>(null)
  const [draft, setDraft] = useState("")
  const [localQuery, setLocalQuery] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<MineducCatalogResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeBook, setActiveBook] = useState<MineducBook | null>(null)
  const [level, setLevel] = useState("Todos")
  const [subject, setSubject] = useState("Todas")
  const [access, setAccess] = useState("Todos")

  const effectiveQuery = (localQuery || query || DEFAULT_QUERY).trim()

  useEffect(() => {
    setPage(1)
  }, [query])

  useEffect(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setLoading(true)
    setError("")

    const params = new URLSearchParams({ q: effectiveQuery, page: String(page), include: "all" })
    fetch(`/api/library/mineduc?${params.toString()}`, { signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "No se pudo cargar MINEDUC")
        return payload as MineducCatalogResponse
      })
      .then((payload) => {
        if (!controller.signal.aborted) setData(payload)
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return
        setData(null)
        setError(cause instanceof Error ? cause.message : "No se pudo consultar el catálogo MINEDUC")
      })
      .finally(() => {
        if (controllerRef.current === controller) {
          controllerRef.current = null
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [effectiveQuery, page])

  const levels = useMemo(() => ["Todos", ...Array.from(new Set((data?.books || []).map((book) => book.level))).sort()], [data])
  const subjects = useMemo(() => ["Todas", ...Array.from(new Set((data?.books || []).map((book) => book.subject))).sort()], [data])

  const books = useMemo(() => {
    return (data?.books || []).filter((book) => {
      if (level !== "Todos" && book.level !== level) return false
      if (subject !== "Todas" && book.subject !== subject) return false
      if (access === "Lectura en EDUAI" && book.access !== "pdf") return false
      if (access === "Acceso oficial" && book.access !== "official") return false
      return true
    })
  }, [access, data, level, subject])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setLocalQuery(draft.trim())
    setPage(1)
  }

  const openBook = (book: MineducBook) => {
    if (book.access === "pdf" && book.pdfUrl) {
      setActiveBook(book)
      return
    }
    const target = book.officialReaderUrl || book.detailUrl
    window.open(target, "_blank", "noopener,noreferrer")
  }

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-red-100 bg-white shadow-sm">
      <div className="border-b border-red-100 bg-gradient-to-br from-red-50 via-white to-blue-50 px-5 py-6 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-red-100 bg-white px-3 py-1 text-[11px] font-black tracking-wide text-red-700">BIBLIOTECA MINEDUC</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700"><ShieldCheck size={12} /> Fuente oficial</span>
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Textos escolares oficiales dentro de EDUAI</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">Busca textos del estudiante, guías y cuadernos publicados por MINEDUC. Cuando existe un PDF público oficial, se abre directamente en el lector de EDUAI; los recursos que requieren autenticación conservan su acceso oficial.</p>
          </div>
          <a href="https://catalogotextos.mineduc.cl/catalogo-textos/login/login" target="_blank" rel="noopener noreferrer" className="inline-flex h-11 flex-shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm hover:border-red-200 hover:text-red-700">
            <ExternalLink size={14} /> Mi Texto Escolar
          </a>
        </div>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Buscar en MINEDUC: Matemática 2° Medio, Física, Leo Primero..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100" />
          </div>
          <button type="submit" className="h-11 rounded-xl bg-slate-950 px-5 text-xs font-bold text-white hover:bg-slate-800">Buscar en MINEDUC</button>
        </form>
      </div>

      <div className="p-5 sm:p-7">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Consulta actual</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800">{effectiveQuery}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={level} onChange={(event) => setLevel(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none">{levels.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={subject} onChange={(event) => setSubject(event.target.value)} className="h-10 max-w-60 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none">{subjects.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={access} onChange={(event) => setAccess(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none"><option>Todos</option><option>Lectura en EDUAI</option><option>Acceso oficial</option></select>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="animate-pulse"><div className="aspect-[2/3] rounded-2xl bg-slate-100" /><div className="mt-3 h-4 rounded bg-slate-100" /><div className="mt-2 h-3 w-2/3 rounded bg-slate-50" /></div>)}</div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{error}</div>
        ) : books.length ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {books.map((book) => (
                <article key={book.id} className="group min-w-0">
                  <button onClick={() => openBook(book)} className="relative block aspect-[2/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                    {book.coverUrl ? <img src={book.coverUrl} alt={`Portada de ${book.title}`} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none" }} /> : coverFallback(book)}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent px-3 pb-3 pt-12 text-white">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black ${book.access === "pdf" ? "border-emerald-300/60 bg-emerald-500/90" : "border-blue-300/60 bg-blue-600/90"}`}>{book.access === "pdf" ? "LEER EN EDUAI" : "ACCESO MINEDUC"}</span>
                    </div>
                  </button>
                  <button onClick={() => openBook(book)} className="mt-3 w-full text-left">
                    <h3 className="line-clamp-2 text-sm font-bold leading-5 text-slate-900 group-hover:text-red-700">{book.title}</h3>
                    <p className="mt-1 truncate text-xs text-slate-500">{book.level} · {book.subject}</p>
                    <p className="mt-1 truncate text-[11px] font-medium text-slate-400">{book.kind} · {book.year}</p>
                  </button>
                </article>
              ))}
            </div>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 disabled:opacity-40"><ChevronLeft size={14} /> Anterior</button>
              <span className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600">Página {page}</span>
              <button onClick={() => setPage((value) => value + 1)} disabled={!data?.hasMore} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 disabled:opacity-40">Siguiente <ChevronRight size={14} /></button>
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"><BookOpenCheck size={30} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-800">No aparecieron textos MINEDUC para esta consulta.</p><p className="mt-1 text-xs text-slate-500">Prueba con curso, asignatura o nombre del texto.</p></div>
        )}
      </div>

      {activeBook && <MineducPdfReader book={activeBook} onClose={() => setActiveBook(null)} />}
    </section>
  )
}
