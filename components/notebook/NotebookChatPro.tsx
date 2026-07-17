"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  ExternalLink,
  FileSearch,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import type { NotebookMessage, NotebookSummary } from "@/lib/notebook/types"

interface NotebookChatProProps {
  notebookId: string
  specialistRole: string
  summary: NotebookSummary | null
  activeSourceCount: number
  onRegenerateSummary: () => void
}

type ExtendedCitation = {
  sourceId: string
  sourceTitle?: string
  sourceUrl?: string | null
  sourceType?: string | null
  chunkId?: string
  snippet?: string
}

const QUICK_PROMPTS = [
  { label: "Resumen", prompt: "Resume las ideas centrales y explica cómo se conectan entre sí. Cita las fuentes utilizadas." },
  { label: "Comparar", prompt: "Compara las fuentes activas: identifica acuerdos, diferencias y posibles contradicciones." },
  { label: "Metodología", prompt: "Analiza las metodologías, procedimientos o enfoques descritos en las fuentes." },
  { label: "Resultados", prompt: "Extrae los principales resultados, hallazgos o conclusiones respaldados por las fuentes." },
  { label: "Limitaciones", prompt: "Identifica limitaciones, vacíos, supuestos y aspectos que las fuentes no permiten concluir." },
  { label: "Preguntas", prompt: "Formula preguntas de investigación o estudio que surjan de las fuentes y explica por qué son relevantes." },
]

export default function NotebookChatPro({
  notebookId,
  specialistRole,
  summary,
  activeSourceCount,
  onRegenerateSummary,
}: NotebookChatProProps) {
  const [messages, setMessages] = useState<NotebookMessage[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState("")
  const [showSummary, setShowSummary] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch(`/api/notebooks/${notebookId}/chat`)
      .then((response) => response.json())
      .then((data) => { if (Array.isArray(data?.messages)) setMessages(data.messages) })
      .catch(() => {})
  }, [notebookId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamText])

  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
  }, [])

  const speak = useCallback((messageId: string, text: string) => {
    if (!("speechSynthesis" in window)) return
    if (speakingId === messageId) {
      window.speechSynthesis.cancel()
      setSpeakingId(null)
      return
    }

    window.speechSynthesis.cancel()
    const cleanText = text
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*/g, "")
      .replace(/`[^`]*`/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .slice(0, 5_000)
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = "es-CL"
    utterance.rate = 1
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang.startsWith("es"))
    if (voice) utterance.voice = voice
    utterance.onend = () => setSpeakingId(null)
    utterance.onerror = () => setSpeakingId(null)
    setSpeakingId(messageId)
    window.speechSynthesis.speak(utterance)
  }, [speakingId])

  const parseCitationsHeader = (value: string | null): ExtendedCitation[] => {
    if (!value) return []
    try {
      const decoded = decodeURIComponent(escape(atob(value)))
      const parsed = JSON.parse(decoded)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
  }

  const sendMessage = async (override?: string) => {
    const content = (override ?? input).trim()
    if (!content || streaming || activeSourceCount === 0) return

    const userMessage: NotebookMessage = {
      id: crypto.randomUUID(),
      notebook_id: notebookId,
      role: "user",
      content,
      citations_json: [],
      created_at: new Date().toISOString(),
    }
    const history = messages.slice(-8).map((message) => ({ role: message.role, content: message.content }))
    setMessages((current) => [...current, userMessage])
    setInput("")
    setStreaming(true)
    setStreamText("")
    setError(null)

    try {
      const response = await fetch(`/api/notebooks/${notebookId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history }),
      })
      const contentType = response.headers.get("content-type") || ""

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || `Error HTTP ${response.status}`)
      }

      if (contentType.includes("text/plain")) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let complete = ""
        while (reader) {
          const { done, value } = await reader.read()
          if (done) break
          complete += decoder.decode(value, { stream: true })
          setStreamText(complete)
        }
        const citations = parseCitationsHeader(response.headers.get("x-citations-b64"))
        setMessages((current) => [...current, {
          id: crypto.randomUUID(),
          notebook_id: notebookId,
          role: "assistant",
          content: complete.trim(),
          citations_json: citations,
          created_at: new Date().toISOString(),
        }])
      } else {
        const data = await response.json()
        setMessages((current) => [...current, {
          id: crypto.randomUUID(),
          notebook_id: notebookId,
          role: "assistant",
          content: data?.text || "No fue posible generar una respuesta.",
          citations_json: Array.isArray(data?.citations) ? data.citations : [],
          created_at: new Date().toISOString(),
        }])
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "No fue posible consultar el cuaderno"
      setError(message)
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        notebook_id: notebookId,
        role: "assistant",
        content: `⚠️ ${message}`,
        citations_json: [],
        created_at: new Date().toISOString(),
      }])
    } finally {
      setStreaming(false)
      setStreamText("")
    }
  }

  const regenerateSummary = async () => {
    setSummaryLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/notebooks/${notebookId}/summary`, { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "No fue posible generar el resumen")
      await Promise.resolve(onRegenerateSummary())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible generar el resumen")
    } finally {
      setSummaryLoading(false)
    }
  }

  const clearConversation = async () => {
    if (!messages.length || !window.confirm("¿Borrar el historial de este chat? Las fuentes no se eliminarán.")) return
    const response = await fetch(`/api/notebooks/${notebookId}/chat`, { method: "DELETE" })
    if (response.ok) setMessages([])
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-soft px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <ShieldCheck size={14} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-main">Chat basado en fuentes</p>
            <p className="truncate text-[10px] text-muted2">{activeSourceCount} {activeSourceCount === 1 ? "fuente activa" : "fuentes activas"} · sin completar con información externa</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void clearConversation()}
          disabled={!messages.length || streaming}
          className="rounded-lg p-1.5 text-muted2 transition hover:bg-red-500/8 hover:text-red-500 disabled:opacity-30"
          title="Limpiar conversación"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {error && <div className="border-b border-soft bg-red-500/7 px-4 py-2 text-[11px] text-red-500">{error}</div>}

      {summary?.summary_markdown ? (
        <section className="border-b border-soft bg-blue-500/[0.025]">
          <button type="button" onClick={() => setShowSummary((value) => !value)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
            <BookOpen size={14} className="text-blue-500" />
            <span className="flex-1 text-xs font-semibold text-sub">Síntesis de las fuentes activas</span>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); void regenerateSummary() }}
              disabled={summaryLoading}
              className="rounded-lg p-1 text-muted2 hover:text-blue-500 disabled:opacity-40"
              title="Actualizar síntesis"
            >
              <RefreshCw size={12} className={summaryLoading ? "animate-spin" : ""} />
            </button>
            {showSummary ? <ChevronUp size={13} className="text-muted2" /> : <ChevronDown size={13} className="text-muted2" />}
          </button>
          {showSummary && (
            <div className="max-h-64 overflow-y-auto px-4 pb-4">
              <div className="prose prose-sm max-w-none text-xs text-sub">
                <ReactMarkdown>{summary.summary_markdown}</ReactMarkdown>
              </div>
              {summary.key_points?.length > 0 && (
                <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {summary.key_points.slice(0, 8).map((point, index) => (
                    <div key={index} className="flex items-start gap-1.5 rounded-lg bg-card-soft-theme px-2 py-1.5 text-[10px] leading-relaxed text-sub">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-500" /> {point}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="border-b border-soft px-4 py-3 text-center">
          <p className="text-[11px] text-muted2">Genera una síntesis después de procesar tus fuentes.</p>
          <button
            type="button"
            onClick={() => void regenerateSummary()}
            disabled={summaryLoading || activeSourceCount === 0}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            {summaryLoading ? <Loader2 size={12} className="animate-spin" /> : <FileSearch size={12} />}
            Generar síntesis
          </button>
        </section>
      )}

      <div className="border-b border-soft px-3 py-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => void sendMessage(item.prompt)}
              disabled={streaming || activeSourceCount === 0}
              className="shrink-0 rounded-full border border-soft bg-card-soft-theme px-3 py-1.5 text-[10px] font-medium text-sub transition hover:border-blue-400/30 hover:bg-blue-500/5 hover:text-blue-500 disabled:opacity-35"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !streaming && (
          <div className="m-auto max-w-sm py-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-500/8 text-3xl">🎓</span>
            <p className="mt-4 text-sm font-semibold text-main">{specialistRole}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted2">
              Analiza documentos, compara papers, revisa argumentos y responde con citas de las fuentes activas.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isSpeaking={speakingId === message.id}
            onSpeak={() => speak(message.id, message.content)}
          />
        ))}

        {streaming && (
          <div className="max-w-[90%] self-start rounded-2xl bg-card-soft-theme px-4 py-3 text-sm text-main">
            {streamText ? (
              <div className="prose prose-sm max-w-none text-main"><ReactMarkdown>{streamText}</ReactMarkdown></div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted2"><Loader2 size={13} className="animate-spin" /> Revisando las fuentes...</div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <footer className="border-t border-soft p-4">
        {activeSourceCount === 0 && (
          <p className="mb-2 rounded-xl bg-amber-500/8 px-3 py-2 text-center text-[10px] text-amber-600">
            Agrega, procesa y activa una fuente para comenzar a conversar.
          </p>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-soft bg-input-theme px-3 py-2 focus-within:border-blue-400">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Pregunta al ${specialistRole} sobre las fuentes...`}
            rows={1}
            disabled={streaming || activeSourceCount === 0}
            className="max-h-32 min-h-7 flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed text-main outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!input.trim() || streaming || activeSourceCount === 0}
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-35"
          >
            {streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[9px] text-muted2">Enter para enviar · Shift+Enter para nueva línea</p>
      </footer>
    </div>
  )
}

function MessageBubble({ message, isSpeaking, onSpeak }: {
  message: NotebookMessage
  isSpeaking: boolean
  onSpeak: () => void
}) {
  const isUser = message.role === "user"
  const citations = (message.citations_json || []) as ExtendedCitation[]
  const [showCitations, setShowCitations] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <article className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${isUser ? "bg-blue-600 text-white" : "bg-card-soft-theme text-main"}`}>
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none text-main"><ReactMarkdown>{message.content}</ReactMarkdown></div>
        )}
      </div>

      {!isUser && (
        <div className="ml-2 flex items-center gap-2">
          <button type="button" onClick={copy} className="flex items-center gap-1 text-[9px] text-muted2 hover:text-blue-500">
            {copied ? <Check size={10} /> : <Clipboard size={10} />} {copied ? "Copiado" : "Copiar"}
          </button>
          {typeof window !== "undefined" && "speechSynthesis" in window && (
            <button type="button" onClick={onSpeak} className={`flex items-center gap-1 text-[9px] ${isSpeaking ? "text-blue-500" : "text-muted2 hover:text-blue-500"}`}>
              {isSpeaking ? <VolumeX size={10} /> : <Volume2 size={10} />} {isSpeaking ? "Detener" : "Escuchar"}
            </button>
          )}
          {citations.length > 0 && (
            <button type="button" onClick={() => setShowCitations((value) => !value)} className="flex items-center gap-1 text-[9px] font-medium text-blue-500">
              {citations.length} {citations.length === 1 ? "fuente" : "fuentes"}
              {showCitations ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
            </button>
          )}
        </div>
      )}

      {!isUser && showCitations && citations.length > 0 && (
        <div className="ml-2 grid max-w-[620px] gap-2 sm:grid-cols-2">
          {citations.map((citation, index) => (
            <CitationCard key={`${citation.sourceId}-${citation.chunkId || index}`} citation={citation} index={index + 1} />
          ))}
        </div>
      )}
    </article>
  )
}

function CitationCard({ citation, index }: { citation: ExtendedCitation; index: number }) {
  const content = (
    <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-2.5 transition hover:border-blue-400/30">
      <div className="flex items-start gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-500/12 text-[9px] font-bold text-blue-500">{index}</span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[10px] font-semibold text-main">{citation.sourceTitle || "Fuente"}</p>
          {citation.snippet && <p className="mt-1 line-clamp-3 text-[9px] leading-relaxed text-muted2">{citation.snippet}</p>}
          <p className="mt-1 text-[8px] uppercase tracking-wide text-blue-500">{citation.sourceType || "documento"}</p>
        </div>
        {citation.sourceUrl && <ExternalLink size={10} className="shrink-0 text-blue-500" />}
      </div>
    </div>
  )

  return citation.sourceUrl ? (
    <a href={citation.sourceUrl} target="_blank" rel="noopener noreferrer">{content}</a>
  ) : content
}
