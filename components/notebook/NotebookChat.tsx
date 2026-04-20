"use client"
// components/notebook/NotebookChat.tsx  v3
// Mejoras: botón TTS en mensajes del asistente (Web Speech API + fallback edge-tts)

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Loader2, RefreshCw, BookOpen, ChevronDown, ChevronUp, Volume2, VolumeX } from "lucide-react"
import ReactMarkdown from "react-markdown"
import type { NotebookMessage, NotebookSummary } from "@/lib/notebook/types"

interface NotebookChatProps {
  notebookId:          string
  specialistRole:      string
  summary:             NotebookSummary | null
  onRegenerateSummary: () => void
}

export default function NotebookChat({
  notebookId, specialistRole, summary, onRegenerateSummary,
}: NotebookChatProps) {
  const [messages,          setMessages]          = useState<NotebookMessage[]>([])
  const [input,             setInput]             = useState("")
  const [streaming,         setStreaming]          = useState(false)
  const [streamText,        setStreamText]         = useState("")
  const [showSummary,       setShowSummary]        = useState(true)
  const [summaryLoading,    setSummaryLoading]     = useState(false)
  const [speakingId,        setSpeakingId]         = useState<string | null>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Cargar historial
  useEffect(() => {
    fetch(`/api/notebooks/${notebookId}/chat`)
      .then((r) => r.json())
      .then((d) => { if (d.messages) setMessages(d.messages) })
      .catch(() => {})
  }, [notebookId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, streamText])

  // ─── TTS con Web Speech API ────────────────────────────────────────────────

  const speak = useCallback((msgId: string, text: string) => {
    if (!("speechSynthesis" in window)) return

    if (speakingId === msgId) {
      window.speechSynthesis.cancel()
      setSpeakingId(null)
      return
    }

    window.speechSynthesis.cancel()
    // Limpiar markdown para TTS
    const cleanText = text
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`[^`]*`/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .slice(0, 3000)

    const utterance  = new SpeechSynthesisUtterance(cleanText)
    utterance.lang   = "es-ES"
    utterance.rate   = 1.0
    utterance.pitch  = 1.0

    // Usar voz española si está disponible
    const voices = window.speechSynthesis.getVoices()
    const esVoice = voices.find((v) => v.lang.startsWith("es") && v.localService)
    if (esVoice) utterance.voice = esVoice

    utterance.onend   = () => setSpeakingId(null)
    utterance.onerror = () => setSpeakingId(null)

    setSpeakingId(msgId)
    window.speechSynthesis.speak(utterance)
  }, [speakingId])

  // ─── Enviar mensaje ────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!input.trim() || streaming) return

    const userMsg: NotebookMessage = {
      id: crypto.randomUUID(), notebook_id: notebookId,
      role: "user", content: input.trim(), citations_json: [],
      created_at: new Date().toISOString(),
    }
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setStreaming(true)
    setStreamText("")

    try {
      const res = await fetch(`/api/notebooks/${notebookId}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ message: userMsg.content, history }),
      })

      const contentType = res.headers.get("content-type") ?? ""

      if (contentType.includes("text/plain")) {
        const reader  = res.body?.getReader()
        const decoder = new TextDecoder()
        let full      = ""
        while (reader) {
          const { done, value } = await reader.read()
          if (done) break
          full += decoder.decode(value)
          setStreamText(full)
        }
        const citations = (() => {
          try { return JSON.parse(res.headers.get("x-citations") ?? "[]") } catch { return [] }
        })()
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(), notebook_id: notebookId,
          role: "assistant", content: full,
          citations_json: citations, created_at: new Date().toISOString(),
        }])
      } else {
        const data = await res.json()
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(), notebook_id: notebookId,
          role: "assistant", content: data.text ?? "Error",
          citations_json: data.citations ?? [], created_at: new Date().toISOString(),
        }])
      }
    } catch {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(), notebook_id: notebookId,
        role: "assistant", content: "Error al procesar la respuesta.",
        citations_json: [], created_at: new Date().toISOString(),
      }])
    } finally {
      setStreaming(false)
      setStreamText("")
    }
  }

  const handleRegenerateSummary = async () => {
    setSummaryLoading(true)
    try {
      await fetch(`/api/notebooks/${notebookId}/summary`, { method: "POST" })
      onRegenerateSummary()
    } finally { setSummaryLoading(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="flex flex-col h-full">

      {/* Resumen */}
      {summary?.summary_markdown && (
        <div className="border-b border-soft" style={{ background: "rgba(37,99,235,0.03)" }}>
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left"
          >
            <BookOpen size={14} style={{ color: "var(--accent-blue)" }} />
            <span className="text-xs font-semibold flex-1" style={{ color: "var(--text-secondary)" }}>
              Resumen del cuaderno
            </span>
            {summaryLoading
              ? <Loader2 size={12} className="animate-spin text-muted2" />
              : (
                <button onClick={(e) => { e.stopPropagation(); handleRegenerateSummary() }}
                  className="mr-2 text-muted2 hover:text-blue-400 transition-colors" title="Regenerar resumen">
                  <RefreshCw size={12} />
                </button>
              )
            }
            {showSummary ? <ChevronUp size={13} className="text-muted2" /> : <ChevronDown size={13} className="text-muted2" />}
          </button>

          {showSummary && (
            <div className="px-4 pb-4">
              {summary.key_points.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Puntos clave
                  </p>
                  <ul className="flex flex-col gap-1">
                    {summary.key_points.slice(0, 5).map((pt, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <span className="mt-0.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "var(--accent-blue)" }} />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.topics.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {summary.topics.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: "rgba(37,99,235,0.1)", color: "var(--accent-blue)" }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!summary && (
        <div className="p-4 border-b border-soft text-center">
          <p className="text-xs text-muted2 mb-2">Agrega fuentes y procésalas para generar el resumen.</p>
          <button onClick={handleRegenerateSummary} disabled={summaryLoading}
            className="text-xs px-3 py-1.5 rounded-xl font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent-blue)" }}>
            {summaryLoading ? <Loader2 size={11} className="animate-spin inline mr-1" /> : null}
            Generar resumen
          </button>
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-3xl mb-3">🎓</p>
            <p className="text-sm font-semibold text-main mb-1">{specialistRole}</p>
            <p className="text-xs text-muted2 max-w-xs mx-auto">
              Pregúntame sobre el contenido de tus fuentes. Solo respondo con información que está en ellas.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg}
            isSpeaking={speakingId === msg.id}
            onSpeak={() => speak(msg.id, msg.content)} />
        ))}

        {streaming && streamText && (
          <div className="rounded-2xl px-4 py-3 text-sm max-w-[88%]"
            style={{ background: "var(--bg-card-soft)", color: "var(--text-primary)" }}>
            <div className="prose prose-sm max-w-none" style={{ color: "var(--text-primary)" }}>
              <ReactMarkdown>{streamText}</ReactMarkdown>
            </div>
          </div>
        )}

        {streaming && !streamText && (
          <div className="flex gap-1 py-2">
            {[0, 150, 300].map((d) => (
              <div key={d} className="w-2 h-2 rounded-full animate-bounce"
                style={{ background: "var(--accent-blue)", animationDelay: `${d}ms`, animationDuration: "0.9s" }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-soft">
        <div className="flex items-end gap-2 rounded-2xl px-3 py-2"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-medium)" }}>
          <textarea ref={textareaRef} value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Pregunta al ${specialistRole}...`}
            rows={1} disabled={streaming}
            className="flex-1 resize-none bg-transparent outline-none text-sm py-1"
            style={{ color: "var(--text-primary)", maxHeight: "120px", lineHeight: "1.5" }} />
          <button onClick={sendMessage} disabled={!input.trim() || streaming}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5 transition-all disabled:opacity-40"
            style={{ background: "var(--accent-blue)" }}>
            {streaming ? <Loader2 size={14} className="animate-spin text-white" /> : <Send size={14} className="text-white" />}
          </button>
        </div>
        <p className="text-[10px] text-muted2 text-center mt-1.5">Shift+Enter para nueva línea</p>
      </div>
    </div>
  )
}

// ─── MessageBubble con TTS ────────────────────────────────────────────────────

function MessageBubble({ message, isSpeaking, onSpeak }: {
  message:    NotebookMessage
  isSpeaking: boolean
  onSpeak:    () => void
}) {
  const isUser = message.role === "user"
  const [showCitations, setShowCitations] = useState(false)

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-1`}>
      <div className="rounded-2xl px-4 py-3 text-sm max-w-[88%]"
        style={{
          background: isUser ? "var(--accent-blue)" : "var(--bg-card-soft)",
          color:      isUser ? "#fff" : "var(--text-primary)",
        }}>
        {isUser
          ? <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
          : (
            <div className="prose prose-sm max-w-none" style={{ color: "var(--text-primary)" }}>
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )
        }
      </div>

      {/* Acciones para mensajes del asistente */}
      {!isUser && (
        <div className="flex items-center gap-2 ml-2">
          {/* Botón TTS */}
          {"speechSynthesis" in (typeof window !== "undefined" ? window : {}) && (
            <button
              onClick={onSpeak}
              className="flex items-center gap-1 text-[10px] transition-colors"
              style={{ color: isSpeaking ? "var(--accent-blue)" : "var(--text-muted)" }}
              title={isSpeaking ? "Detener" : "Escuchar respuesta"}
            >
              {isSpeaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
              {isSpeaking ? "Detener" : "Escuchar"}
            </button>
          )}

          {/* Citas */}
          {message.citations_json.length > 0 && (
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="text-[10px] text-muted2 hover:text-sub transition-colors flex items-center gap-1"
            >
              {message.citations_json.length} fuente{message.citations_json.length > 1 ? "s" : ""}
              {showCitations ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
            </button>
          )}
        </div>
      )}

      {!isUser && showCitations && message.citations_json.length > 0 && (
        <div className="flex flex-col gap-1 ml-2 max-w-[400px]">
          {message.citations_json.map((c, i) => (
            <div key={i} className="text-[10px] px-2 py-1.5 rounded-lg"
              style={{ background: "rgba(37,99,235,0.07)", borderLeft: "2px solid var(--accent-blue)", color: "var(--text-secondary)" }}>
              <span className="font-semibold">{c.sourceTitle ?? "Fuente"}: </span>
              {c.snippet?.slice(0, 100)}...
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
