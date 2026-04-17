"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  ArrowLeft,
  FileText,
  Upload,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileSearch,
  BookOpen,
  Hash,
  X,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────
type Citation = {
  chunkIndex: number
  sectionTitle: string | null
  pageStart: number
  pageEnd: number
}

type PaperMessage = {
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
  isOverview?: boolean
}

type ExtractResponse = {
  title: string
  text: string
  summary: string
  pageCount: number
  truncated: boolean
  extractionMethod: string
  parserUsed: string
  ocrUsed: boolean
  fromCache: boolean
  bucket: string
  filePath: string
  documentId: string | null
  chunkCount: number
  error?: boolean
}

type ChatResponse = {
  text: string
  provider?: string
  model?: string
  citations?: Citation[]
  extractionMethod?: string
  parserUsed?: string
  ocrUsed?: boolean
  fromCache?: boolean
  error?: string
}

const STORAGE_BUCKET = "papers"

const SUGGESTED_QUESTIONS = [
  "¿Cuál es la idea central del documento?",
  "Explícamelo en términos simples",
  "¿Qué metodología usa?",
  "¿Cuáles son los resultados más importantes?",
  "¿Qué conclusiones saca el autor?",
  "¿Qué limitaciones tiene el estudio?",
  "¿Hay fórmulas o datos numéricos clave?",
  "¿Qué sigue después de leer esto?",
]

// ─── Markdown Renderer ────────────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n")
  const elements: React.ReactNode[] = []
  let listBuffer: string[] = []
  let key = 0

  function flushList() {
    if (listBuffer.length === 0) return
    elements.push(
      <ul key={key++} className="list-none space-y-1.5 my-2">
        {listBuffer.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-pink-400/70 flex-shrink-0" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    )
    listBuffer = []
  }

  function renderInline(raw: string): React.ReactNode {
    const parts: React.ReactNode[] = []
    let remaining = raw
    let i = 0

    while (remaining.length > 0) {
      // **bold**
      const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)$/)
      if (boldMatch) {
        if (boldMatch[1]) parts.push(<span key={i++}>{boldMatch[1]}</span>)
        parts.push(<strong key={i++} className="font-semibold text-main">{boldMatch[2]}</strong>)
        remaining = boldMatch[3]
        continue
      }
      // *italic*
      const italicMatch = remaining.match(/^(.*?)\*(.+?)\*(.*)$/)
      if (italicMatch) {
        if (italicMatch[1]) parts.push(<span key={i++}>{italicMatch[1]}</span>)
        parts.push(<em key={i++} className="italic text-sub">{italicMatch[2]}</em>)
        remaining = italicMatch[3]
        continue
      }
      // `code`
      const codeMatch = remaining.match(/^(.*?)`(.+?)`(.*)$/)
      if (codeMatch) {
        if (codeMatch[1]) parts.push(<span key={i++}>{codeMatch[1]}</span>)
        parts.push(
          <code key={i++} className="px-1.5 py-0.5 rounded-md text-xs font-mono bg-pink-500/10 text-pink-300 border border-pink-500/20">
            {codeMatch[2]}
          </code>
        )
        remaining = codeMatch[3]
        continue
      }
      parts.push(<span key={i++}>{remaining}</span>)
      break
    }
    return <>{parts}</>
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      elements.push(<div key={key++} className="h-2" />)
      continue
    }

    // ### Header
    if (trimmed.startsWith("### ")) {
      flushList()
      elements.push(
        <h4 key={key++} className="font-semibold text-main text-sm mt-3 mb-1">
          {renderInline(trimmed.slice(4))}
        </h4>
      )
      continue
    }
    if (trimmed.startsWith("## ")) {
      flushList()
      elements.push(
        <h3 key={key++} className="font-bold text-main text-base mt-4 mb-1.5">
          {renderInline(trimmed.slice(3))}
        </h3>
      )
      continue
    }
    if (trimmed.startsWith("# ")) {
      flushList()
      elements.push(
        <h2 key={key++} className="font-bold text-main text-lg mt-4 mb-2">
          {renderInline(trimmed.slice(2))}
        </h2>
      )
      continue
    }

    // List items: - item or * item
    if (/^[-*•]\s+/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^[-*•]\s+/, ""))
      continue
    }

    // Numbered list: 1. item
    if (/^\d+\.\s+/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^\d+\.\s+/, ""))
      continue
    }

    // Normal paragraph
    flushList()
    elements.push(
      <p key={key++} className="text-sm leading-relaxed text-sub">
        {renderInline(trimmed)}
      </p>
    )
  }
  flushList()
  return <>{elements}</>
}

// ─── Citation Badge ───────────────────────────────────────────────────────────
function CitationBadge({ citation, index }: { citation: Citation; index: number }) {
  const pages =
    citation.pageStart === citation.pageEnd
      ? `p. ${citation.pageStart}`
      : `pp. ${citation.pageStart}–${citation.pageEnd}`

  return (
    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium border border-pink-500/20 bg-pink-500/8 text-pink-300">
      <Hash size={9} />
      {citation.sectionTitle ? `${citation.sectionTitle} · ` : ""}
      {pages}
    </span>
  )
}

// ─── Typing Dots ──────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-pink-400/60 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}

// ─── APaper Avatar ────────────────────────────────────────────────────────────
function APaperAvatar({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex-shrink-0 rounded-xl flex items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
        boxShadow: "0 0 12px rgba(236,72,153,0.25)",
        fontSize: size * 0.45,
      }}
    >
      📄
    </div>
  )
}

// ─── Document Overview Card ───────────────────────────────────────────────────
function DocumentOverviewCard({
  title,
  pageCount,
  chunkCount,
  summary,
}: {
  title: string
  pageCount: number
  chunkCount: number
  summary: string
}) {
  return (
    <div className="rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/8 to-violet-500/8 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-600/20 to-violet-600/20 border border-pink-500/20 flex items-center justify-center text-lg flex-shrink-0">
          📄
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-main text-sm leading-tight break-words">{title}</div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[11px] text-muted2 flex items-center gap-1">
              <BookOpen size={10} /> {pageCount} {pageCount === 1 ? "página" : "páginas"}
            </span>
            <span className="text-[11px] text-muted2 flex items-center gap-1">
              <Hash size={10} /> {chunkCount} fragmentos
            </span>
          </div>
        </div>
      </div>

      {summary && (
        <p className="text-sm text-sub leading-relaxed border-t border-pink-500/10 pt-3">
          {summary}
        </p>
      )}
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, paperTitle, pageCount, chunkCount, paperSummary }: {
  msg: PaperMessage
  paperTitle?: string
  pageCount?: number
  chunkCount?: number
  paperSummary?: string
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow-lg shadow-pink-900/20">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 items-start">
      <APaperAvatar size={32} />
      <div className="flex-1 min-w-0 space-y-2">
        {msg.isOverview && paperTitle && (
          <DocumentOverviewCard
            title={paperTitle}
            pageCount={pageCount ?? 0}
            chunkCount={chunkCount ?? 0}
            summary={paperSummary ?? ""}
          />
        )}

        {msg.content && (
          <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-card-soft-theme border border-soft">
            <div className="prose prose-sm max-w-none">
              {renderMarkdown(msg.content)}
            </div>
          </div>
        )}

        {!!msg.citations?.length && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {msg.citations.map((c, i) => (
              <CitationBadge key={i} citation={c} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Drop Overlay ─────────────────────────────────────────────────────────────
function DropOverlay({ onDrop }: { onDrop: (file: File) => void }) {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    function onDragOver(e: DragEvent) { e.preventDefault(); setDragging(true) }
    function onDragLeave() { setDragging(false) }
    function onDropEvt(e: DragEvent) {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer?.files?.[0]
      if (file?.type === "application/pdf") onDrop(file)
    }
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("drop", onDropEvt)
    return () => {
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("drop", onDropEvt)
    }
  }, [onDrop])

  if (!dragging) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="rounded-3xl border-2 border-dashed border-pink-400 px-16 py-12 text-center">
        <div className="text-5xl mb-3">📄</div>
        <p className="text-main font-semibold">Suelta el PDF aquí</p>
        <p className="text-sub text-sm mt-1">APaper lo analizará al instante</p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PaperPage() {
  const supabase = createClient()

  const [userReady, setUserReady] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [chatting, setChatting] = useState(false)

  const [paperTitle, setPaperTitle] = useState("Documento")
  const [paperText, setPaperText] = useState("")
  const [paperSummary, setPaperSummary] = useState("")
  const [paperPageCount, setPaperPageCount] = useState(0)
  const [storagePath, setStoragePath] = useState("")
  const [storageBucket, setStorageBucket] = useState(STORAGE_BUCKET)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [extractionMethod, setExtractionMethod] = useState("")
  const [parserUsed, setParserUsed] = useState("")
  const [ocrUsed, setOcrUsed] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const [chunkCount, setChunkCount] = useState(0)

  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<PaperMessage[]>([])
  const [error, setError] = useState("")
  const [docPanelOpen, setDocPanelOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const hasDocument = useMemo(() => !!storagePath && !!paperText.trim(), [storagePath, paperText])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserReady(true)
      else window.location.href = "/login"
    })
  }, [supabase])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, chatting, extracting])

  async function readErrorResponse(res: Response) {
    const ct = res.headers.get("content-type") || ""
    if (ct.includes("application/json")) {
      try { const d = await res.json(); return d?.error || d?.message || `Error ${res.status}` } catch {}
    }
    try { return (await res.text()) || `Error ${res.status}` } catch { return `Error ${res.status}` }
  }

  const handleUploadFile = useCallback(async (file: File) => {
    setError("")
    setUploading(true)
    setExtracting(false)
    setMessages([])
    setPaperText("")
    setPaperSummary("")
    setPaperPageCount(0)
    setStoragePath("")
    setDocumentId(null)
    setChunkCount(0)
    setDocPanelOpen(false)

    try {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) throw new Error("Sesión no válida.")

      if (file.name.split(".").pop()?.toLowerCase() !== "pdf") {
        throw new Error("Por ahora solo se permiten archivos PDF.")
      }

      const path = `${user.id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || "application/pdf" })

      if (uploadError) throw uploadError

      setStoragePath(path)
      setStorageBucket(STORAGE_BUCKET)
      setPaperTitle(file.name.replace(/\.pdf$/i, ""))

      await runExtraction({ bucket: STORAGE_BUCKET, filePath: path, filename: file.name, forceRefresh: false })
    } catch (e: any) {
      console.error("[Paper][upload]", e)
      setError(e?.message || "No se pudo subir el documento.")
    } finally {
      setUploading(false)
    }
  }, [supabase])

  async function runExtraction(params: { bucket: string; filePath: string; filename?: string; forceRefresh?: boolean }) {
    setExtracting(true)
    setError("")

    try {
      const res = await fetch("/api/agents/paper/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })

      if (!res.ok) throw new Error(await readErrorResponse(res))

      const data: ExtractResponse = await res.json()

      setPaperTitle(data.title || params.filename || "Documento")
      setPaperText(data.text || "")
      setPaperSummary(data.summary || "")
      setPaperPageCount(data.pageCount || 0)
      setStoragePath(data.filePath)
      setStorageBucket(data.bucket)
      setDocumentId(data.documentId)
      setExtractionMethod(data.extractionMethod || "")
      setParserUsed(data.parserUsed || "")
      setOcrUsed(!!data.ocrUsed)
      setFromCache(!!data.fromCache)
      setChunkCount(data.chunkCount || 0)
      setDocPanelOpen(true)

      if (!data.error) {
        const shortTitle = (data.title || params.filename || "este documento").replace(/\.pdf$/i, "")
        const welcomeLines = [
          `Listo, ya leí **${shortTitle}** completo.`,
          data.pageCount > 1
            ? `Son ${data.pageCount} páginas divididas en ${data.chunkCount} fragmentos que puedo consultar al instante.`
            : `Es un documento de 1 página dividido en ${data.chunkCount} fragmentos.`,
          `¿Qué quieres saber sobre él? Puedes preguntarme por las ideas principales, metodología, resultados, conclusiones o cualquier parte específica.`,
        ].join(" ")

        setMessages([{
          role: "assistant",
          content: welcomeLines,
          isOverview: true,
        }])
      }
    } catch (e: any) {
      console.error("[Paper][extract]", e)
      setError(e?.message || "No se pudo procesar el documento.")
    } finally {
      setExtracting(false)
    }
  }

  async function handleAsk(customQuestion?: string) {
    const q = (customQuestion ?? question).trim()
    if (!q || !storagePath || chatting) return

    setChatting(true)
    setError("")
    const nextMessages: PaperMessage[] = [...messages, { role: "user", content: q }]
    setMessages(nextMessages)
    setQuestion("")

    try {
      const res = await fetch("/api/agents/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          history: nextMessages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          paperTitle,
          storagePath,
          storageBucket,
          documentId,
        }),
      })

      if (!res.ok) throw new Error(await readErrorResponse(res))
      const data: ChatResponse = await res.json()

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.text || "No pude responder con suficiente información.",
          citations: data.citations || [],
        },
      ])

      if (data.extractionMethod) setExtractionMethod(data.extractionMethod)
      if (data.parserUsed) setParserUsed(data.parserUsed)
      if (typeof data.ocrUsed === "boolean") setOcrUsed(data.ocrUsed)
      if (typeof data.fromCache === "boolean") setFromCache(data.fromCache)
    } catch (e: any) {
      console.error("[Paper][chat]", e)
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Ocurrió un error al analizar el documento: ${e?.message || "Error desconocido."}` },
      ])
    } finally {
      setChatting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  if (!userReady) {
    return (
      <div className="min-h-screen bg-app text-main flex items-center justify-center">
        <div className="flex items-center gap-3 text-sub">
          <Loader2 className="animate-spin" size={18} />
          Cargando...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app text-main flex flex-col">
      <DropOverlay onDrop={handleUploadFile} />

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-soft bg-app/90 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-8 h-8 rounded-xl flex items-center justify-center border border-soft bg-card-soft-theme text-sub hover:text-main transition"
          >
            <ArrowLeft size={15} />
          </Link>

          <APaperAvatar size={36} />

          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm">Chat Paper</h1>
            <p className="text-xs text-muted2 truncate">
              {hasDocument ? paperTitle : "Sube un PDF para comenzar"}
            </p>
          </div>

          {hasDocument && (
            <button
              onClick={() => setDocPanelOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-soft bg-card-soft-theme px-3 py-1.5 text-xs text-sub hover:text-main transition"
            >
              <FileText size={12} />
              {docPanelOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUploadFile(file)
              e.target.value = ""
            }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || extracting}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white text-xs font-semibold disabled:opacity-50 transition"
          >
            {uploading || extracting ? (
              <><Loader2 size={12} className="animate-spin" />{uploading ? "Subiendo…" : "Procesando…"}</>
            ) : (
              <><Upload size={12} />PDF</>
            )}
          </button>
        </div>

        {/* Document status panel */}
        {hasDocument && docPanelOpen && (
          <div className="border-t border-soft bg-app/95 backdrop-blur">
            <div className="max-w-3xl mx-auto px-4 py-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-xl border border-soft bg-card-soft-theme px-3 py-2">
                  <div className="text-muted2 mb-0.5">Páginas</div>
                  <div className="font-semibold text-main">{paperPageCount}</div>
                </div>
                <div className="rounded-xl border border-soft bg-card-soft-theme px-3 py-2">
                  <div className="text-muted2 mb-0.5">Fragmentos</div>
                  <div className="font-semibold text-main">{chunkCount}</div>
                </div>
                <div className="rounded-xl border border-soft bg-card-soft-theme px-3 py-2">
                  <div className="text-muted2 mb-0.5">Parser</div>
                  <div className="font-semibold text-main">{parserUsed || "-"}</div>
                </div>
                <div className="rounded-xl border border-soft bg-card-soft-theme px-3 py-2">
                  <div className="text-muted2 mb-0.5">Caché / OCR</div>
                  <div className="font-semibold text-main">{fromCache ? "Sí" : "No"} / {ocrUsed ? "Sí" : "No"}</div>
                </div>
              </div>

              {paperSummary && (
                <p className="mt-3 text-xs text-sub leading-relaxed border-t border-soft pt-3">
                  {paperSummary}
                </p>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => runExtraction({ bucket: storageBucket, filePath: storagePath, filename: paperTitle, forceRefresh: true })}
                  disabled={extracting}
                  className="flex items-center gap-1.5 rounded-xl border border-soft bg-card-soft-theme px-3 py-1.5 text-xs text-sub hover:text-main disabled:opacity-50 transition"
                >
                  {extracting ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  Reprocesar
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── Suggested chips (when doc loaded) ── */}
      {hasDocument && (
        <div className="sticky top-[57px] z-10 border-b border-soft bg-app/80 backdrop-blur">
          <div className="max-w-3xl mx-auto px-4 py-2 overflow-x-auto flex gap-2 no-scrollbar">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                disabled={chatting || extracting}
                onClick={() => handleAsk(q)}
                className="flex-shrink-0 rounded-full border border-soft bg-card-soft-theme hover:border-pink-500/40 hover:bg-pink-500/5 px-3 py-1.5 text-xs text-sub hover:text-main transition disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat messages ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {/* Empty state */}
          {!messages.length && !extracting && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-5"
                style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.15) 0%, rgba(139,92,246,0.15) 100%)", border: "1px solid rgba(236,72,153,0.2)" }}
              >
                📄
              </div>
              <h2 className="font-bold text-main text-lg mb-2">Sube un PDF para comenzar</h2>
              <p className="text-sub text-sm max-w-sm leading-relaxed mb-6">
                APaper analiza tu documento, lo indexa por fragmentos y te permite hacer preguntas en lenguaje natural como si hablaras con alguien que lo leyó todo.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-2xl px-6 py-3 bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white font-semibold text-sm disabled:opacity-50"
              >
                <Upload size={15} />
                Elegir PDF
              </button>
              <p className="text-muted2 text-xs mt-3">o arrastra un PDF a esta ventana</p>
            </div>
          )}

          {/* Extracting state */}
          {extracting && !messages.length && (
            <div className="flex gap-3 items-start">
              <APaperAvatar size={32} />
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-card-soft-theme border border-soft">
                <div className="flex items-center gap-2 text-sub text-sm">
                  <Loader2 size={14} className="animate-spin text-pink-400" />
                  Leyendo y fragmentando el documento…
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, index) => (
            <MessageBubble
              key={index}
              msg={msg}
              paperTitle={paperTitle}
              pageCount={paperPageCount}
              chunkCount={chunkCount}
              paperSummary={paperSummary}
            />
          ))}

          {/* Thinking dots */}
          {chatting && (
            <div className="flex gap-3 items-start">
              <APaperAvatar size={32} />
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-card-soft-theme border border-soft">
                <TypingDots />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-sm flex-shrink-0">
                ✕
              </div>
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-red-500/8 border border-red-500/20 text-red-400 text-sm">
                {error}
                <button onClick={() => setError("")} className="ml-2 opacity-50 hover:opacity-100">
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ── Input ── */}
      <div className="sticky bottom-0 z-10 border-t border-soft bg-app/90 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                hasDocument
                  ? "Pregúntale a APaper sobre el documento… (Enter para enviar)"
                  : "Primero sube un PDF para poder hacer preguntas"
              }
              disabled={!hasDocument || chatting || extracting}
              rows={1}
              style={{ minHeight: 44, maxHeight: 140, resize: "none" }}
              className="flex-1 rounded-2xl bg-card-soft-theme border border-soft px-4 py-3 text-sm text-main placeholder:text-muted2 focus:outline-none focus:border-pink-500/50 disabled:opacity-40 leading-normal"
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = "auto"
                el.style.height = Math.min(el.scrollHeight, 140) + "px"
              }}
            />
            <button
              onClick={() => handleAsk()}
              disabled={!hasDocument || !question.trim() || chatting || extracting}
              className="h-11 w-11 rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white flex items-center justify-center disabled:opacity-40 transition flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
          <p className="text-center text-[10px] text-muted2 mt-1.5">
            APaper puede cometer errores. Verifica información importante en el documento original.
          </p>
        </div>
      </div>

      {/* Scrollbar hide */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
