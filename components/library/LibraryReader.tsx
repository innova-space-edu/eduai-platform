"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Copy,
  ExternalLink,
  Highlighter,
  Loader2,
  Maximize2,
  Minus,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  StickyNote,
  Sun,
  Trash2,
  Volume2,
  X,
} from "lucide-react"
import {
  LibraryBook,
  ReadingProgress,
  libraryStorageKeys,
  loadArchiveFullText,
  paginateBookText,
} from "@/lib/library/catalog"

type ReaderTheme = "paper" | "sepia" | "night"
type SideTab = "ai" | "notes"

type ReaderNote = {
  id: string
  quote: string
  text: string
  page: number
  createdAt: string
}

type ReaderHighlight = {
  quote: string
  page: number
}

type LibraryReaderProps = {
  book: LibraryBook
  userId: string
  onClose: () => void
  onProgress: (progress: ReadingProgress) => void
}

const QUICK_AI_ACTIONS = [
  "Resume esta página",
  "Explica las palabras difíciles",
  "Identifica las ideas principales",
  "Crea 5 preguntas de comprensión",
]

const READER_THEME: Record<ReaderTheme, { background: string; color: string; surface: string }> = {
  paper: { background: "#ffffff", color: "#1f2937", surface: "#f8fafc" },
  sepia: { background: "#f6eddc", color: "#4a3728", surface: "#efe2cb" },
  night: { background: "#111827", color: "#e5e7eb", surface: "#1f2937" },
}

function renderHighlightedText(text: string, highlights: string[]) {
  let chunks: Array<{ value: string; marked: boolean }> = [{ value: text, marked: false }]

  for (const highlight of highlights.filter((item) => item.trim().length >= 3)) {
    chunks = chunks.flatMap((chunk) => {
      if (chunk.marked) return [chunk]
      const parts = chunk.value.split(highlight)
      if (parts.length === 1) return [chunk]
      return parts.flatMap((part, index) => {
        const result: Array<{ value: string; marked: boolean }> = []
        if (part) result.push({ value: part, marked: false })
        if (index < parts.length - 1) result.push({ value: highlight, marked: true })
        return result
      })
    })
  }

  return chunks.map((chunk, index) =>
    chunk.marked ? (
      <mark key={`${index}-${chunk.value.slice(0, 24)}`} className="rounded px-0.5" style={{ background: "#fde68a", color: "#422006" }}>
        {chunk.value}
      </mark>
    ) : (
      <span key={`${index}-${chunk.value.slice(0, 24)}`}>{chunk.value}</span>
    ),
  )
}

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "") as T
  } catch {
    return fallback
  }
}

export default function LibraryReader({ book, userId, onClose, onProgress }: LibraryReaderProps) {
  const readerRef = useRef<HTMLDivElement | null>(null)
  const textRequestRef = useRef<AbortController | null>(null)
  const aiRequestRef = useRef<AbortController | null>(null)
  const activeBookRef = useRef(book.id)

  const [fullText, setFullText] = useState(book.content || "")
  const [textLoading, setTextLoading] = useState(false)
  const [textError, setTextError] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [fontSize, setFontSize] = useState(19)
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>("paper")
  const [selectedQuote, setSelectedQuote] = useState("")
  const [sidePanelOpen, setSidePanelOpen] = useState(true)
  const [sideTab, setSideTab] = useState<SideTab>("ai")
  const [notes, setNotes] = useState<ReaderNote[]>([])
  const [highlights, setHighlights] = useState<ReaderHighlight[]>([])
  const [noteText, setNoteText] = useState("")
  const [aiQuestion, setAiQuestion] = useState("")
  const [aiAnswer, setAiAnswer] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [toast, setToast] = useState("")

  const keys = useMemo(() => libraryStorageKeys(userId), [userId])
  const pages = useMemo(() => (fullText ? paginateBookText(fullText) : []), [fullText])
  const currentPageText = pages[pageIndex] || ""
  const pageHighlights = highlights.filter((highlight) => highlight.page === pageIndex).map((highlight) => highlight.quote)
  const canReadInsideEduai = book.accessMode === "eduai" || book.accessMode === "preview"

  useEffect(() => {
    activeBookRef.current = book.id
    setFullText(book.content || "")
    setTextError("")
    setSelectedQuote("")
    setNoteText("")
    setAiAnswer("")
    setAiQuestion("")
    setPageIndex(0)
    setNotes(readJson<ReaderNote[]>(keys.notes(book.id), []))
    setHighlights(readJson<ReaderHighlight[]>(keys.highlights(book.id), []))

    const progress = readJson<Record<string, ReadingProgress>>(keys.progress, {})[book.id]
    const savedPage = progress?.page || 0

    textRequestRef.current?.abort()
    aiRequestRef.current?.abort()

    if (book.content) {
      const nextPages = paginateBookText(book.content)
      setPageIndex(Math.min(savedPage, Math.max(0, nextPages.length - 1)))
      return
    }

    if (book.accessMode !== "eduai" || !book.iaId) return

    const controller = new AbortController()
    textRequestRef.current = controller
    setTextLoading(true)

    loadArchiveFullText(book.iaId, controller.signal)
      .then((text) => {
        if (activeBookRef.current !== book.id || controller.signal.aborted) return
        const nextPages = paginateBookText(text)
        setFullText(text)
        setPageIndex(Math.min(savedPage, Math.max(0, nextPages.length - 1)))
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setTextError(error instanceof Error ? error.message : "No se pudo cargar esta edición")
      })
      .finally(() => {
        if (textRequestRef.current === controller) {
          textRequestRef.current = null
          setTextLoading(false)
        }
      })

    return () => controller.abort()
  }, [book, keys])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 2300)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (pages.length === 0) return
    onProgress({
      book,
      page: pageIndex,
      totalPages: pages.length,
      updatedAt: new Date().toISOString(),
    })
  }, [book, onProgress, pageIndex, pages.length])

  useEffect(() => {
    return () => {
      textRequestRef.current?.abort()
      aiRequestRef.current?.abort()
      window.speechSynthesis?.cancel()
    }
  }, [])

  const handleSelection = () => {
    const selection = window.getSelection()?.toString().trim() || ""
    if (selection.length >= 2) setSelectedQuote(selection.slice(0, 3000))
  }

  const copySelection = async () => {
    const value = selectedQuote || window.getSelection()?.toString().trim() || ""
    if (!value) {
      setToast("Selecciona un fragmento primero")
      return
    }
    await navigator.clipboard.writeText(value)
    setToast("Fragmento copiado")
  }

  const saveHighlight = () => {
    if (!selectedQuote) {
      setToast("Selecciona un fragmento para resaltarlo")
      return
    }
    const duplicate = highlights.some((item) => item.page === pageIndex && item.quote === selectedQuote)
    const next = duplicate ? highlights : [...highlights, { quote: selectedQuote, page: pageIndex }]
    setHighlights(next)
    localStorage.setItem(keys.highlights(book.id), JSON.stringify(next))
    setToast("Fragmento resaltado")
  }

  const removeHighlight = (highlight: ReaderHighlight) => {
    const next = highlights.filter((item) => !(item.page === highlight.page && item.quote === highlight.quote))
    setHighlights(next)
    localStorage.setItem(keys.highlights(book.id), JSON.stringify(next))
  }

  const saveNote = () => {
    if (!noteText.trim() && !selectedQuote) {
      setToast("Escribe una nota o selecciona un fragmento")
      return
    }

    const next: ReaderNote[] = [
      {
        id: crypto.randomUUID(),
        quote: selectedQuote,
        text: noteText.trim() || "Fragmento guardado para revisar.",
        page: pageIndex,
        createdAt: new Date().toISOString(),
      },
      ...notes,
    ]
    setNotes(next)
    localStorage.setItem(keys.notes(book.id), JSON.stringify(next))
    setNoteText("")
    setSidePanelOpen(true)
    setSideTab("notes")
    setToast("Nota guardada")
  }

  const deleteNote = (noteId: string) => {
    const next = notes.filter((note) => note.id !== noteId)
    setNotes(next)
    localStorage.setItem(keys.notes(book.id), JSON.stringify(next))
  }

  const speakText = () => {
    if (!("speechSynthesis" in window) || !currentPageText) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(selectedQuote || currentPageText)
    utterance.lang = "es-ES"
    utterance.rate = 0.95
    window.speechSynthesis.speak(utterance)
    setToast(selectedQuote ? "Leyendo el fragmento" : "Leyendo la página")
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await readerRef.current?.requestFullscreen()
    } catch {
      setToast("El navegador no permitió pantalla completa")
    }
  }

  const askAi = async (question?: string) => {
    const finalQuestion = question || aiQuestion.trim()
    if (!finalQuestion || aiLoading) return

    aiRequestRef.current?.abort()
    const controller = new AbortController()
    aiRequestRef.current = controller
    const requestedBookId = book.id

    setAiLoading(true)
    setAiAnswer("")
    setSidePanelOpen(true)
    setSideTab("ai")

    const contextText = (selectedQuote || currentPageText).slice(0, 18000)
    const prompt = [
      `Libro: ${book.title}`,
      `Autor: ${book.author}`,
      `Página del visor: ${pageIndex + 1} de ${Math.max(1, pages.length)}`,
      `Texto disponible:\n${contextText}`,
      `Pregunta del lector: ${finalQuestion}`,
      "Responde en español, con lenguaje educativo y utiliza solamente el texto proporcionado. Cita la página del visor y reconoce claramente cuando falta información.",
    ].join("\n\n")

    try {
      const response = await fetch("/api/superagent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          task: "reasoning",
          maxTokens: 1200,
          skipTools: true,
          context: {
            page: "Biblioteca EDUAI",
            pageMode: "lector-completo",
            subject: "Lenguaje y Literatura",
          },
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo consultar a EDUAI")
      if (activeBookRef.current !== requestedBookId || aiRequestRef.current !== controller) return
      setAiAnswer(data.text || "No se recibió una respuesta.")
      setAiQuestion("")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      if (activeBookRef.current !== requestedBookId || aiRequestRef.current !== controller) return
      setAiAnswer(error instanceof Error ? error.message : "No se pudo consultar a EDUAI")
    } finally {
      if (aiRequestRef.current === controller) {
        aiRequestRef.current = null
        setAiLoading(false)
      }
    }
  }

  const goToPage = (nextPage: number) => {
    setPageIndex(Math.max(0, Math.min(nextPage, Math.max(0, pages.length - 1))))
    setSelectedQuote("")
  }

  const accessLabel =
    book.accessMode === "borrow"
      ? "Solicitar préstamo en la plataforma oficial"
      : book.accessMode === "external"
        ? "Leer en la plataforma oficial"
        : "Ver disponibilidad en Open Library"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-2 backdrop-blur-sm sm:p-4">
      <div
        ref={readerRef}
        className="flex h-full max-h-[calc(100vh-1rem)] w-full max-w-[1650px] flex-col overflow-hidden rounded-2xl border border-white/40 bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:rounded-3xl"
      >
        <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden h-12 w-9 overflow-hidden rounded-lg bg-slate-100 sm:block">
              <img src={book.cover} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-950 sm:text-base">{book.title}</h2>
              <p className="truncate text-xs text-slate-500">{book.author} · {book.source} · {book.rights}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSidePanelOpen((value) => !value)}
              className="hidden h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 md:flex"
            >
              {sidePanelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
              {sidePanelOpen ? "Ocultar panel" : "IA y notas"}
            </button>
            <button onClick={toggleFullscreen} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Pantalla completa">
              <Maximize2 size={16} />
            </button>
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" aria-label="Cerrar visor">
              <X size={17} />
            </button>
          </div>
        </header>

        {canReadInsideEduai && (textLoading || fullText) && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-5">
            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1">
              <button onClick={() => setFontSize((size) => Math.max(14, size - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Reducir texto">
                <Minus size={15} />
              </button>
              <span className="min-w-12 text-center text-xs font-bold text-slate-600">{fontSize}px</span>
              <button onClick={() => setFontSize((size) => Math.min(32, size + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Aumentar texto">
                <Plus size={15} />
              </button>
            </div>

            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1">
              <button onClick={() => setReaderTheme("paper")} className={`flex h-8 w-8 items-center justify-center rounded-lg ${readerTheme === "paper" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-100"}`} title="Fondo claro">
                <Sun size={15} />
              </button>
              <button onClick={() => setReaderTheme("sepia")} className={`flex h-8 w-8 items-center justify-center rounded-lg ${readerTheme === "sepia" ? "bg-amber-50 text-amber-700" : "text-slate-500 hover:bg-slate-100"}`} title="Fondo sepia">
                <BookOpen size={15} />
              </button>
              <button onClick={() => setReaderTheme("night")} className={`flex h-8 w-8 items-center justify-center rounded-lg ${readerTheme === "night" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"}`} title="Modo nocturno">
                <Moon size={15} />
              </button>
            </div>

            <button onClick={copySelection} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100">
              <Copy size={15} /> Copiar
            </button>
            <button onClick={saveHighlight} className="flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100">
              <Highlighter size={15} /> Resaltar
            </button>
            <button onClick={() => { setSidePanelOpen(true); setSideTab("notes") }} className="flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100">
              <StickyNote size={15} /> Nota
            </button>
            <button onClick={speakText} className="flex h-10 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-semibold text-violet-700 hover:bg-violet-100">
              <Volume2 size={15} /> Escuchar
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => goToPage(pageIndex - 1)} disabled={pageIndex === 0} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-35" aria-label="Página anterior">
                <ArrowLeft size={15} />
              </button>
              <span className="min-w-24 text-center text-xs font-bold text-slate-600">{pages.length > 0 ? `${pageIndex + 1} / ${pages.length}` : "Cargando"}</span>
              <button onClick={() => goToPage(pageIndex + 1)} disabled={pages.length === 0 || pageIndex >= pages.length - 1} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-35" aria-label="Página siguiente">
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        <div className={`grid min-h-0 flex-1 ${sidePanelOpen ? "md:grid-cols-[minmax(0,1fr)_360px]" : "grid-cols-1"}`}>
          <main className="min-h-0 overflow-auto" style={{ background: READER_THEME[readerTheme].surface }}>
            {textLoading ? (
              <div className="flex min-h-full items-center justify-center p-8">
                <div className="text-center">
                  <Loader2 size={36} className="mx-auto animate-spin text-blue-600" />
                  <h3 className="mt-4 text-lg font-bold text-slate-900">Cargando el texto completo</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">EDUAI está obteniendo la edición pública y preparando páginas seleccionables.</p>
                </div>
              </div>
            ) : fullText && currentPageText ? (
              <div className="mx-auto min-h-full max-w-5xl px-3 py-6 sm:px-8 sm:py-10">
                <article
                  onMouseUp={handleSelection}
                  onKeyUp={handleSelection}
                  className="mx-auto min-h-[75vh] max-w-4xl rounded-2xl border px-5 py-8 shadow-sm sm:px-12 sm:py-12"
                  style={{
                    background: READER_THEME[readerTheme].background,
                    color: READER_THEME[readerTheme].color,
                    borderColor: readerTheme === "night" ? "#334155" : "#e2e8f0",
                    fontSize,
                    lineHeight: 1.85,
                    fontFamily: "Georgia, Cambria, 'Times New Roman', serif",
                  }}
                >
                  <div className="mb-8 border-b pb-5" style={{ borderColor: readerTheme === "night" ? "#334155" : "#e2e8f0" }}>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-55">{book.source} · Página {pageIndex + 1}</p>
                    <h1 className="mt-2 text-2xl font-bold leading-tight">{book.title}</h1>
                    <p className="mt-1 text-sm opacity-65">{book.author}</p>
                  </div>
                  <div className="whitespace-pre-wrap break-words text-justify">
                    {renderHighlightedText(currentPageText, pageHighlights)}
                  </div>
                </article>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <button onClick={() => goToPage(pageIndex - 1)} disabled={pageIndex === 0} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm disabled:opacity-40">
                    <ArrowLeft size={15} /> Anterior
                  </button>
                  <div className="h-2 min-w-20 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all" style={{ width: `${((pageIndex + 1) / pages.length) * 100}%` }} />
                  </div>
                  <button onClick={() => goToPage(pageIndex + 1)} disabled={pageIndex >= pages.length - 1} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm disabled:opacity-40">
                    Siguiente <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-full items-center justify-center p-6 sm:p-10">
                <div className="grid w-full max-w-4xl gap-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[190px_minmax(0,1fr)] md:p-8">
                  <div className="mx-auto aspect-[2/3] w-full max-w-[190px] overflow-hidden rounded-2xl bg-slate-100 shadow-lg">
                    <img src={book.cover} alt={`Portada de ${book.title}`} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{book.rights}</span>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{book.title}</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">{book.author} · {book.year}</p>
                    <p className="mt-5 text-sm leading-7 text-slate-600">{textError || book.description}</p>
                    <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                      {textError
                        ? "Esta edición no entregó un archivo de texto seleccionable. Puedes utilizar el lector oficial para leerla o solicitar el préstamo correspondiente."
                        : book.accessMode === "borrow"
                          ? "Los libros actuales protegidos se leen mediante préstamo en la plataforma oficial. EDUAI no copia ni elimina su DRM."
                          : "La disponibilidad de esta obra debe confirmarse en la plataforma oficial."}
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <a href={book.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20">
                        <ExternalLink size={16} /> {accessLabel}
                      </a>
                      {book.accessMode === "eduai" && book.iaId && (
                        <button onClick={() => { setTextError(""); setFullText(""); const controller = new AbortController(); textRequestRef.current = controller; setTextLoading(true); loadArchiveFullText(book.iaId!, controller.signal).then(setFullText).catch((error) => setTextError(error instanceof Error ? error.message : "No se pudo reintentar")).finally(() => setTextLoading(false)) }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                          <RotateCcw size={16} /> Reintentar texto
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>

          {sidePanelOpen && (
            <aside className="min-h-0 overflow-auto border-l border-slate-200 bg-white">
              <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-white p-2">
                <button onClick={() => setSideTab("ai")} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ${sideTab === "ai" ? "bg-violet-50 text-violet-700" : "text-slate-500 hover:bg-slate-50"}`}>
                  <Bot size={15} /> EDUAI
                </button>
                <button onClick={() => setSideTab("notes")} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ${sideTab === "notes" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}>
                  <StickyNote size={15} /> Notas ({notes.length})
                </button>
              </div>

              {sideTab === "ai" ? (
                <div className="p-4">
                  <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-violet-800"><Sparkles size={16} /> Asistente contextual</div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">Analiza el fragmento seleccionado o la página actual. No utiliza páginas que no estén cargadas.</p>
                  </div>

                  {selectedQuote && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Texto seleccionado</p>
                      <p className="mt-2 line-clamp-5 text-xs italic leading-5 text-amber-950">“{selectedQuote}”</p>
                    </div>
                  )}

                  <div className="mt-4 grid gap-2">
                    {QUICK_AI_ACTIONS.map((action) => (
                      <button key={action} onClick={() => askAi(action)} disabled={!currentPageText || aiLoading} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 disabled:opacity-40">
                        {action}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <textarea value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} placeholder="Pregunta sobre esta página o selección..." className="min-h-24 w-full resize-none bg-transparent text-sm text-slate-800 outline-none" />
                    <button onClick={() => askAi()} disabled={!aiQuestion.trim() || aiLoading || !currentPageText} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                      {aiLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      {aiLoading ? "Analizando" : "Preguntar a EDUAI"}
                    </button>
                  </div>

                  {aiAnswer && <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-violet-100 bg-violet-50/60 p-4 text-sm leading-6 text-slate-700">{aiAnswer}</div>}
                </div>
              ) : (
                <div className="p-4">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-xs font-bold text-blue-800">Nueva nota · página {pageIndex + 1}</p>
                    {selectedQuote && <p className="mt-2 line-clamp-4 text-xs italic leading-5 text-blue-950">“{selectedQuote}”</p>}
                    <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Escribe tu interpretación, pregunta o comentario..." className="mt-3 min-h-24 w-full resize-none rounded-xl border border-blue-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-blue-100" />
                    <button onClick={saveNote} className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700">Guardar nota</button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {notes.map((note) => (
                      <div key={note.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <button onClick={() => goToPage(note.page)} className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Página {note.page + 1}</button>
                          <button onClick={() => deleteNote(note.id)} className="text-slate-400 hover:text-rose-600" aria-label="Eliminar nota"><Trash2 size={14} /></button>
                        </div>
                        {note.quote && <p className="mt-2 line-clamp-4 text-xs italic leading-5 text-slate-500">“{note.quote}”</p>}
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.text}</p>
                      </div>
                    ))}
                    {notes.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aún no tienes notas en este libro.</p>}
                  </div>

                  {highlights.length > 0 && (
                    <div className="mt-6 border-t border-slate-200 pt-5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Resaltados</h3>
                      <div className="mt-3 space-y-2">
                        {highlights.map((highlight, index) => (
                          <div key={`${highlight.page}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <button onClick={() => goToPage(highlight.page)} className="text-[10px] font-bold text-amber-700">Página {highlight.page + 1}</button>
                              <button onClick={() => removeHighlight(highlight)} className="text-amber-500 hover:text-rose-600" aria-label="Eliminar resaltado"><Trash2 size={13} /></button>
                            </div>
                            <p className="mt-1 line-clamp-4 text-xs leading-5 text-amber-950">{highlight.quote}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-xl">{toast}</div>}
    </div>
  )
}
