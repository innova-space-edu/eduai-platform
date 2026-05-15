// components/superagent/SuperAgentChat.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Componente de chat reutilizable del SuperAgent EduAI Claw.
// Se puede embeber en cualquier página: examen, planificador, admin, etc.
// Props: context para contextualizar las respuestas automáticamente.
// ─────────────────────────────────────────────────────────────────────────────

"use client"

import React, {
  useCallback, useEffect, useRef, useState
} from "react"

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant"

interface Message {
  id:          string
  role:        Role
  content:     string
  provider?:   string
  model?:      string
  toolUsed?:   string
  latencyMs?:  number
  loading?:    boolean
}

export interface SuperAgentChatContext {
  page?:          string
  subject?:       string
  examTitle?:     string
  studentCourse?: string
}

interface SuperAgentChatProps {
  context?:        SuperAgentChatContext
  placeholder?:    string
  initialMessage?: string          // mensaje de bienvenida personalizado
  compact?:        boolean         // modo compacto para panels laterales
  maxHeight?:      string          // altura máxima del área de mensajes
  showProviderInfo?: boolean       // mostrar proveedor/modelo en cada mensaje
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function renderMd(text: string) {
  return text
    .replace(/!\[([^\]]*)\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g, "<img src=\"$2\" alt=\"$1\" class=\"mt-3 max-h-80 w-full rounded-xl border border-soft object-contain bg-white\" />")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g,
      "<code class='bg-card-soft-theme px-1.5 py-0.5 rounded text-xs font-mono'>$1</code>")
    .replace(/^### (.+)/gm, "<h3 class='font-bold text-sm mt-3 mb-1'>$1</h3>")
    .replace(/^## (.+)/gm,  "<h2 class='font-bold text-base mt-4 mb-1'>$1</h2>")
    .replace(/^- (.+)/gm,   "<li class='ml-4 list-disc text-sm'>$1</li>")
    .replace(/\n\n/g, "</p><p class='mt-2'>")
}

function providerColor(p?: string) {
  if (!p) return "text-muted2"
  if (p.includes("Groq"))      return "text-orange-500"
  if (p.includes("Gemini"))    return "text-blue-500"
  if (p.includes("OpenRouter") || p.includes("Kimi")) return "text-purple-500"
  if (p.includes("Cerebras"))  return "text-emerald-500"
  if (p.includes("Tools"))     return "text-teal-500"
  return "text-muted2"
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function SuperAgentChat({
  context,
  placeholder     = "Escribe aquí… (Enter para enviar)",
  initialMessage  = "¡Hola! Soy **EduAI Claw** 🦅. ¿En qué te ayudo?",
  compact         = false,
  maxHeight       = "400px",
  showProviderInfo = true,
}: SuperAgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: uid(), role: "assistant", content: initialMessage },
  ])
  const [input,   setInput]   = useState("")
  const [loading, setLoading] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const abortRef  = useRef<AbortController | null>(null)

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg:    Message = { id: uid(), role: "user",      content }
    const loadingMsg: Message = { id: uid(), role: "assistant", content: "", loading: true }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setInput("")
    setLoading(true)
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const history = messages
      .filter(m => !m.loading)
      .map(m => ({ role: m.role, content: m.content }))
    history.push({ role: "user", content })

    try {
      const res = await fetch("/api/superagent/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  abortRef.current.signal,
        body: JSON.stringify({
          messages: history,
          task:      "general",
          maxTokens: 2000,
          context,
        }),
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? "Error del servidor")

      const reply: Message = {
        id:         loadingMsg.id,
        role:       "assistant",
        content:    data.text,
        provider:   data.provider,
        model:      data.model,
        toolUsed:   data.toolUsed,
        latencyMs:  data.latencyMs,
        loading:    false,
      }

      setMessages(prev => prev.map(m => m.id === loadingMsg.id ? reply : m))
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages(prev => prev.filter(m => m.id !== loadingMsg.id))
      } else {
        setMessages(prev => prev.map(m =>
          m.id === loadingMsg.id
            ? { ...m, content: `❌ ${err instanceof Error ? err.message : "Error"}`, loading: false }
            : m
        ))
      }
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, messages, context])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={[
      "flex flex-col rounded-2xl border border-soft bg-card-theme overflow-hidden",
      compact ? "text-sm" : "",
    ].join(" ")}>

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-soft px-4 py-3 bg-card-soft-theme">
        <span className="text-lg">🦅</span>
        <span className="font-semibold text-main text-sm">EduAI Claw</span>
        {context?.subject && (
          <span className="ml-auto text-xs text-sub border border-soft rounded-full px-2 py-0.5">
            {context.subject}
          </span>
        )}
      </div>

      {/* Mensajes */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ maxHeight }}
      >
        {messages.map(msg => (
          <div
            key={msg.id}
            className={[
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start",
            ].join(" ")}
          >
            {msg.role === "assistant" && (
              <span className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xs shrink-0 mr-2 mt-1">
                🦅
              </span>
            )}
            <div className={[
              "max-w-[85%] rounded-2xl px-3 py-2",
              msg.role === "user"
                ? "bg-violet-600 text-white text-sm"
                : "bg-card-soft-theme border border-soft",
            ].join(" ")}>
              {msg.loading ? (
                <div className="flex items-center gap-2 text-sub">
                  <span className="w-3 h-3 border-2 border-soft border-t-violet-500 rounded-full animate-spin" />
                  <span className="text-xs">Pensando…</span>
                </div>
              ) : (
                <>
                  <div
                    className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }}
                  />
                  {showProviderInfo && msg.role === "assistant" && msg.provider && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] font-medium ${providerColor(msg.provider)}`}>
                        ⚡ {msg.provider}
                      </span>
                      {msg.toolUsed && (
                        <span className="text-[10px] text-teal-600 border border-teal-500/20 rounded-full px-1.5 py-0.5">
                          🛠 {msg.toolUsed.replace(/_/g, " ")}
                        </span>
                      )}
                      {msg.latencyMs && (
                        <span className="text-[10px] text-muted2">{msg.latencyMs}ms</span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-soft p-3 flex items-end gap-2 bg-card-soft-theme">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={compact ? 1 : 2}
          disabled={loading}
          className="flex-1 resize-none rounded-xl border border-soft bg-card-theme px-3 py-2 text-sm text-main placeholder:text-sub focus:outline-none focus:border-violet-500/40 disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="shrink-0 w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
        >
          {loading
            ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <span className="text-base leading-none">↑</span>
          }
        </button>
      </div>
    </div>
  )
}
