"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { BookOpenCheck, ExternalLink, Filter, Loader2, Search, ShieldCheck } from "lucide-react"
import FullTextReader from "@/components/library/FullTextReader"
import { FULLTEXT_SOURCE_LABELS, type FullTextBook, type FullTextSearchResponse, type FullTextSourceId } from "@/lib/library/fulltext"

type Props = {
  query?: string
}

const DEFAULT_QUERY = "educación"
const SOURCE_ORDER: FullTextSourceId[] = ["openstax", "open-textbook-library", "wikibooks", "scielo", "wikisource", "google-books"]

function sourceBadge(sourceId: FullTextSourceId) {
  if (sourceId === "openstax") return "border-orange-200 bg-orange-50 text-orange-700"
  if (sourceId === "open-textbook-library") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (sourceId === "wikibooks" || sourceId === "wikisource") return "border-slate-200 bg-slate-50 text-slate-700"
  if (sourceId === "scielo") return "border-cyan-200 bg-cyan-50 text-cyan-700"
  return "border-blue-200 bg-blue-50 text-blue-700"
}

function coverFallback(book: FullTextBook) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-4 text-center">
      <BookOpenCheck size={30} className="text-emerald-600" />
      <p className="mt-4 line-clamp-4 text-sm font-bold leading-5 text-slate-800">{book.title}</p>
      <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">{book.source}</p>
    </div>
  )
}

export default function FullTextLibrarySection({ query = "" }: Props) {
  const controllerRef = useRef<AbortController | null>(null)
  const [draft, setDraft] = useState("")
  const [localQuery, setLocalQuery] = useState("")
  const [data, setData] = useState<FullTextSearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [source, setSource] = useState<FullTextSourceId | "all">("all")
  const [activeBook, setActiveBook] = useState<FullTextBook | null>(null)

  const effectiveQuery = (localQuery || query || DEFAULT_QUERY).trim()

  useEffect(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setLoading(true)
    setError("")

    const params = new URLSearchParams({ q: effectiveQuery })
    fetch(`/api/library/fulltext?${params.toString()}`, { signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "No se pudo consultar la biblioteca de texto completo")
        return payload as FullTextSearchResponse
      })
      .then((payload) => {
        if (!controller.signal.aborted) setData(payload)
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return
        setData(null)
        setError(cause instanceof Error ? cause.message : "No se pudo consultar las fuentes abiertas")
      })
      .finally(() => {
        if (controllerRef.current === controller) {
          controllerRef.current = null
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [effectiveQuery])

  const books = useMemo(() => {
    const values = (data?.books || []).filter((book) => book.complete)
    return source === "all" ? values : values.filter((book) => book.sourceId === source)
  }, [data, source])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = draft.trim()
    if (!value) return
    setLocalQuery(value)
    setSource("all")
  }

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
      <div className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-blue-50 px-5 py-6 sm:px-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-5xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-600 px-3 py-1 text-[11px] font-black tracking-wide text-white">TEXTO COMPLETO · PRIORIDAD 1</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-white px-3 py-1 text-[10px] font-bold text-emerald-700"><ShieldCheck size={12} /> Solo acceso completo</span>
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Biblioteca abierta federada de EDUAI</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">EDUAI consulta Google Books, SciELO Books, Wikisource, Wikibooks, OpenStax y Open Textbook Library, pero muestra aquí únicamente resultados identificados como libros o textos completos. Los recursos incompletos y vistas previas no entran en esta sección.</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Resultados completos</p>
            <p className="mt-1 text-2xl font-black text-emerald-700">{loading ? "…" : books.length}</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Buscar texto completo: estadística, física, biología, Don Quijote..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" />
          </div>
          <button type="submit" className="h-11 rounded-xl bg-slate-950 px-5 text-xs font-bold text-white hover:bg-slate-800">Buscar textos completos</button>
        </form>
      </div>

      <div className="p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Consulta actual</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800">{effectiveQuery}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400"><Filter size={13} /> Fuente:</span>
            <button onClick={() => setSource("all")} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${source === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}>Todas</button>
            {SOURCE_ORDER.map((sourceId) => {
              const count = data?.sourceCounts[sourceId] || 0
              return <button key={sourceId} onClick={() => setSource(sourceId)} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${source === sourceId ? "border-slate-900 bg-slate-900 text-white" : sourceBadge(sourceId)}`}>{FULLTEXT_SOURCE_LABELS[sourceId]} · {count}</button>
            })}
          </div>
        </div>

        {loading ? (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 12 }).map((_, index) => <div key={index} className="animate-pulse"><div className="aspect-[2/3] rounded-2xl bg-slate-100" /><div className="mt-3 h-4 rounded bg-slate-100" /><div className="mt-2 h-3 w-2/3 rounded bg-slate-50" /></div>)}</div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{error}</div>
        ) : books.length ? (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {books.map((book) => (
              <article key={book.id} className="group min-w-0">
                <button onClick={() => setActiveBook(book)} className="relative block aspect-[2/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  {book.coverUrl ? <img src={book.coverUrl} alt={`Portada de ${book.title}`} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none" }} /> : coverFallback(book)}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/55 to-transparent px-3 pb-3 pt-14 text-white">
                    <span className="inline-flex rounded-full border border-emerald-300/60 bg-emerald-500/90 px-2 py-1 text-[9px] font-black">TEXTO COMPLETO</span>
                    <p className="mt-2 text-[10px] font-bold text-white/80">{book.format}</p>
                  </div>
                </button>
                <div className="mt-3">
                  <button onClick={() => setActiveBook(book)} className="w-full text-left"><h3 className="line-clamp-2 text-sm font-bold leading-5 text-slate-900 group-hover:text-emerald-700">{book.title}</h3><p className="mt-1 truncate text-xs text-slate-500">{book.author}</p></button>
                  <div className="mt-2 flex items-center justify-between gap-2"><span className={`truncate rounded-full border px-2 py-1 text-[9px] font-black ${sourceBadge(book.sourceId)}`}>{book.source}</span><a href={book.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700"><ExternalLink size={12} /></a></div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"><BookOpenCheck size={32} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-800">No aparecieron textos completos con este filtro.</p><p className="mt-1 text-xs text-slate-500">Prueba otra materia, título o cambia la fuente seleccionada.</p></div>
        )}

        {data?.failedSources?.length ? <p className="mt-5 text-[11px] text-slate-400">Algunas fuentes no respondieron en esta consulta: {data.failedSources.map((id) => FULLTEXT_SOURCE_LABELS[id as FullTextSourceId] || id).join(", ")}.</p> : null}
      </div>

      {activeBook && <FullTextReader book={activeBook} onClose={() => setActiveBook(null)} />}
    </section>
  )
}
