"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, ExternalLink, Loader2, Maximize2, Volume2, X } from "lucide-react"
import { paginateBookText } from "@/lib/library/catalog"
import type { FullTextBook } from "@/lib/library/fulltext"

type Props = {
  book: FullTextBook
  onClose: () => void
}

export default function FullTextReader({ book, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [page, setPage] = useState(0)
  const pages = useMemo(() => (text ? paginateBookText(text, 10000) : []), [text])

  useEffect(() => {
    setText("")
    setError("")
    setPage(0)
    if (book.readerType !== "wikimedia" || !book.wikiProject || !book.wikiTitle) return

    const controller = new AbortController()
    setLoading(true)
    const params = new URLSearchParams({ project: book.wikiProject, title: book.wikiTitle })
    fetch(`/api/library/fulltext/read?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "No se pudo abrir el texto")
        return payload as { text: string }
      })
      .then((payload) => setText(payload.text))
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return
        setError(cause instanceof Error ? cause.message : "No se pudo abrir el texto")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [book])

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await rootRef.current?.requestFullscreen()
    } catch {
      // Browser can deny fullscreen without affecting reading.
    }
  }

  const speak = () => {
    if (!("speechSynthesis" in window) || !pages[page]) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(pages[page])
    utterance.lang = "es-CL"
    utterance.rate = 0.95
    window.speechSynthesis.speak(utterance)
  }

  const embedded = (book.readerType === "google" || book.readerType === "pdf") && book.readerUrl

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-4">
      <div ref={rootRef} className="flex h-full max-h-[calc(100vh-1rem)] w-full max-w-[1700px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:rounded-3xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">TEXTO COMPLETO</span>
              <span className="text-[11px] font-bold text-slate-400">{book.source}</span>
            </div>
            <h2 className="mt-1 truncate text-sm font-bold text-slate-950 sm:text-base">{book.title}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {book.readerType === "wikimedia" && pages.length > 0 && <button onClick={speak} className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"><Volume2 size={15} /> Escuchar</button>}
            <a href={book.sourceUrl} target="_blank" rel="noopener noreferrer" className="hidden h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 sm:flex"><ExternalLink size={14} /> Fuente</a>
            <button onClick={fullscreen} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"><Maximize2 size={16} /></button>
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"><X size={17} /></button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden bg-slate-100">
          {embedded ? (
            <iframe src={book.readerUrl} title={book.title} className="h-full w-full border-0 bg-white" allow="fullscreen" />
          ) : book.readerType === "wikimedia" ? (
            loading ? (
              <div className="flex h-full items-center justify-center"><div className="text-center"><Loader2 size={34} className="mx-auto animate-spin text-blue-600" /><p className="mt-3 text-sm font-bold text-slate-700">Preparando texto completo</p></div></div>
            ) : error ? (
              <div className="flex h-full items-center justify-center p-6"><div className="max-w-xl rounded-3xl border border-amber-200 bg-white p-7 text-center"><p className="text-sm text-slate-700">{error}</p><a href={book.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white"><ExternalLink size={14} /> Leer en Wikimedia</a></div></div>
            ) : pages.length ? (
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1 overflow-auto px-3 py-5 sm:px-8 sm:py-8">
                  <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white px-5 py-8 text-justify font-serif text-[18px] leading-8 text-slate-800 shadow-sm sm:px-12 sm:py-12">
                    <div className="whitespace-pre-wrap">{pages[page]}</div>
                  </article>
                </div>
                <div className="flex items-center gap-3 border-t border-slate-200 bg-white px-4 py-3">
                  <button onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0} className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 disabled:opacity-40"><ArrowLeft size={14} /> Anterior</button>
                  <div className="min-w-0 flex-1"><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-slate-900 transition-all" style={{ width: `${((page + 1) / pages.length) * 100}%` }} /></div><p className="mt-1 text-center text-[10px] font-bold text-slate-400">{page + 1} / {pages.length}</p></div>
                  <button onClick={() => setPage((value) => Math.min(pages.length - 1, value + 1))} disabled={page >= pages.length - 1} className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 disabled:opacity-40">Siguiente <ArrowRight size={14} /></button>
                </div>
              </div>
            ) : null
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">ACCESO COMPLETO</span>
                <h3 className="mt-4 text-2xl font-bold text-slate-950">{book.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">Esta fuente entrega el libro completo desde su lector oficial. EDUAI conserva el enlace original y no duplica innecesariamente el archivo.</p>
                <a href={book.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white"><ExternalLink size={16} /> Leer libro completo</a>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
