// app/superagent/chat/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// EduAI Claw — Chat SuperAgent con proveedores gratuitos 2026
// Streaming, selector de tarea, indicador de modelo, historial local
// ─────────────────────────────────────────────────────────────────────────────

"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Role    = "user" | "assistant" | "system"
type TaskType = "general" | "fast" | "coding" | "reasoning" | "long_context"

type ChatMessage = {
  id:       string
  role:     Role
  content:  string
  provider?: string
  model?:   string
  task?:    TaskType
  latencyMs?: number
  loading?: boolean
}

type ProviderInfo = {
  name: string
  configured: boolean
  free: boolean
  rpmLimit: number
  dailyLimit: string
  bestFor: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function providerColor(p?: string) {
  if (!p) return "text-sub"
  if (p.includes("Groq"))     return "text-orange-500"
  if (p.includes("Gemini"))   return "text-blue-500"
  if (p.includes("Kimi") || p.includes("OpenRouter")) return "text-purple-500"
  if (p.includes("Cerebras")) return "text-emerald-500"
  return "text-sub"
}

const TASK_OPTIONS: { value: TaskType; label: string; icon: string; desc: string }[] = [
  { value: "general",      label: "General",       icon: "💬", desc: "Gemini Flash · contexto 1M" },
  { value: "fast",         label: "Ultra rápido",  icon: "⚡", desc: "Groq · sub-100ms" },
  { value: "coding",       label: "Código",        icon: "💻", desc: "Kimi K2 · líder 2026" },
  { value: "reasoning",    label: "Razonamiento",  icon: "🧠", desc: "Kimi K2 / DeepSeek R1" },
  { value: "long_context", label: "Documentos",    icon: "📄", desc: "Gemini Flash · 1M tokens" },
]

const QUICK_PROMPTS = [
  { label: "Crear examen",          icon: "📝", text: "Crea 5 preguntas de alternativas sobre " },
  { label: "Adaptar para PIE",      icon: "♿", text: "Adapta este contenido para estudiantes con dislexia: " },
  { label: "Planificación de clase",icon: "📚", text: "Crea una planificación de clase para " },
  { label: "Rúbrica de evaluación", icon: "📊", text: "Diseña una rúbrica para evaluar " },
  { label: "Explicar concepto",     icon: "🔬", text: "Explica de forma simple y con ejemplos: " },
  { label: "Preguntas STEM",        icon: "⚗️", text: "Genera preguntas de Física/Química sobre " },
]

// ── Renderizador simple de markdown ──────────────────────────────────────────
function renderMd(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code class='bg-card-soft-theme px-1.5 py-0.5 rounded text-sm font-mono'>$1</code>")
    .replace(/^### (.*)/gm, "<h3 class='font-bold text-base mt-4 mb-1'>$1</h3>")
    .replace(/^## (.*)/gm,  "<h2 class='font-bold text-lg mt-5 mb-2'>$1</h2>")
    .replace(/^# (.*)/gm,   "<h1 class='font-bold text-xl mt-6 mb-2'>$1</h1>")
    .replace(/^- (.*)/gm,   "<li class='ml-4 list-disc'>$1</li>")
    .replace(/\n{2,}/g,     "</p><p class='mt-3'>")
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function SuperAgentChatPage() {
  const [messages,       setMessages]       = useState<ChatMessage[]>([])
  const [input,          setInput]          = useState("")
  const [task,           setTask]           = useState<TaskType>("general")
  const [loading,        setLoading]        = useState(false)
  const [providers,      setProviders]      = useState<ProviderInfo[]>([])
  const [showProviders,  setShowProviders]  = useState(false)
  const [context,        setContext]        = useState({ subject: "", page: "chat" })

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const abortRef   = useRef<AbortController | null>(null)

  // Cargar estado de proveedores al inicio
  useEffect(() => {
    fetch("/api/superagent/chat")
      .then(r => r.json())
      .then(d => { if (d.providers) setProviders(d.providers) })
      .catch(() => {})
  }, [])

  // Auto-scroll al nuevo mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Mensaje de bienvenida
  useEffect(() => {
    setMessages([{
      id:       uid(),
      role:     "assistant",
      content:  "¡Hola! Soy **EduAI Claw** 🦅, tu superagente educativo.\n\nPuedo ayudarte a crear evaluaciones, planificar clases, adaptar contenidos para PIE/NEE, resolver dudas pedagógicas y mucho más.\n\n¿En qué trabajamos hoy?",
      provider: "Sistema",
      model:    "EduAI Claw v2",
    }])
  }, [])

  // ── Enviar mensaje ────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (content?: string) => {
    const text = (content ?? input).trim()
    if (!text || loading) return

    // Agregar mensaje del usuario
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text }
    const loadingMsg: ChatMessage = {
      id: uid(), role: "assistant", content: "", loading: true,
    }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setInput("")
    setLoading(true)
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const history = messages
      .filter(m => m.role !== "system")
      .map(m => ({ role: m.role, content: m.content }))

    history.push({ role: "user", content: text })

    const t0 = Date.now()

    try {
      const res = await fetch("/api/superagent/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  abortRef.current.signal,
        body: JSON.stringify({
          messages: history,
          task,
          maxTokens: task === "long_context" ? 4000 : 2000,
          stream: false, // Usar non-stream para máxima compatibilidad
          context,
        }),
      })

      const data = await res.json()

      if (!data.success) throw new Error(data.error ?? "Error del servidor")

      const assistantMsg: ChatMessage = {
        id:        loadingMsg.id,
        role:      "assistant",
        content:   data.text,
        provider:  data.provider,
        model:     data.model,
        task:      data.task,
        latencyMs: data.latencyMs ?? (Date.now() - t0),
      }

      setMessages(prev =>
        prev.map(m => m.id === loadingMsg.id ? assistantMsg : m)
      )
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages(prev => prev.filter(m => m.id !== loadingMsg.id))
      } else {
        const errMsg: ChatMessage = {
          id:      loadingMsg.id,
          role:    "assistant",
          content: `❌ Error: ${err instanceof Error ? err.message : "Error desconocido"}`,
        }
        setMessages(prev =>
          prev.map(m => m.id === loadingMsg.id ? errMsg : m)
        )
      }
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, messages, task, context])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([{
      id: uid(), role: "assistant",
      content: "Chat reiniciado. ¿En qué te ayudo?",
      provider: "Sistema", model: "EduAI Claw v2",
    }])
  }

  const configuredCount = providers.filter(p => p.configured).length

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-app text-main overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-soft bg-card-theme shrink-0">
        <div className="p-4 border-b border-soft">
          <Link href="/superagent" className="text-xs text-sub hover:text-main">
            ← EduAI Claw
          </Link>
          <h1 className="mt-2 text-lg font-bold">SuperAgent Chat</h1>
          <p className="text-xs text-sub mt-0.5">Modelos gratuitos · 2026</p>
        </div>

        {/* Selector de tarea */}
        <div className="p-4 border-b border-soft">
          <p className="text-xs uppercase tracking-widest text-sub mb-3">Tipo de tarea</p>
          <div className="space-y-1">
            {TASK_OPTIONS.map(({ value, label, icon, desc }) => (
              <button
                key={value}
                onClick={() => setTask(value)}
                className={[
                  "w-full flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors",
                  task === value
                    ? "bg-violet-500/15 border border-violet-500/30"
                    : "hover:bg-card-soft-theme border border-transparent",
                ].join(" ")}
              >
                <span className="text-lg shrink-0">{icon}</span>
                <div>
                  <p className="text-sm font-medium text-main">{label}</p>
                  <p className="text-[10px] text-sub mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Asignatura */}
        <div className="p-4 border-b border-soft">
          <p className="text-xs uppercase tracking-widest text-sub mb-2">Contexto</p>
          <select
            value={context.subject}
            onChange={e => setContext(c => ({ ...c, subject: e.target.value }))}
            className="w-full rounded-xl bg-card-soft-theme border border-soft px-3 py-2 text-sm text-main"
          >
            <option value="">Sin asignatura</option>
            {["Matemática","Lenguaje","Física","Química","Biología",
              "Historia","Inglés","Educación Física","Artes","Tecnología"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Proveedores */}
        <div className="p-4 flex-1 overflow-y-auto">
          <button
            onClick={() => setShowProviders(v => !v)}
            className="w-full flex items-center justify-between text-xs text-sub hover:text-main"
          >
            <span className="uppercase tracking-widest">Proveedores</span>
            <span className={[
              "text-[10px] px-2 py-0.5 rounded-full font-bold",
              configuredCount > 0
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-red-500/15 text-red-600",
            ].join(" ")}>
              {configuredCount}/{providers.length} activos
            </span>
          </button>

          {showProviders && providers.map(p => (
            <div key={p.name} className="mt-3 rounded-xl border border-soft bg-card-soft-theme p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-main">{p.name}</span>
                <span className={[
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  p.configured
                    ? "bg-emerald-500/15 text-emerald-600"
                    : "bg-red-500/15 text-red-600",
                ].join(" ")}>
                  {p.configured ? "✓" : "✗"}
                </span>
              </div>
              <p className="text-[10px] text-sub mt-1">{p.dailyLimit}</p>
              <p className="text-[10px] text-muted2 mt-0.5">{p.bestFor}</p>
            </div>
          ))}
        </div>

        {/* Acciones */}
        <div className="p-4 border-t border-soft space-y-2">
          <button
            onClick={clearChat}
            className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-sm text-sub hover:text-main"
          >
            🗑 Limpiar chat
          </button>
          <Link
            href="/examen/crear"
            className="flex items-center justify-center w-full rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-600 hover:bg-violet-500/20"
          >
            📝 Ir a Crear Examen
          </Link>
        </div>
      </aside>

      {/* ── Panel principal ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header móvil */}
        <header className="flex items-center justify-between gap-3 border-b border-soft bg-card-theme px-4 py-3 lg:hidden shrink-0">
          <div className="flex items-center gap-2">
            <Link href="/superagent" className="text-sub">←</Link>
            <span className="font-bold text-sm">EduAI Claw</span>
          </div>
          <div className="flex gap-2">
            <select
              value={task}
              onChange={e => setTask(e.target.value as TaskType)}
              className="rounded-xl border border-soft bg-card-soft-theme px-2 py-1 text-xs text-main"
            >
              {TASK_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
            <button
              onClick={clearChat}
              className="rounded-xl border border-soft bg-card-soft-theme px-2 py-1 text-xs text-sub"
            >
              🗑
            </button>
          </div>
        </header>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">

          {/* Accesos rápidos (solo cuando el chat está vacío o casi vacío) */}
          {messages.length <= 1 && (
            <div className="max-w-2xl mx-auto">
              <p className="text-xs uppercase tracking-widest text-sub text-center mb-4">
                Acciones rápidas
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {QUICK_PROMPTS.map(({ label, icon, text }) => (
                  <button
                    key={label}
                    onClick={() => setInput(text)}
                    className="flex items-center gap-2 rounded-2xl border border-soft bg-card-soft-theme p-3 text-left hover:border-violet-500/30 hover:bg-violet-500/5 transition-colors"
                  >
                    <span className="text-lg shrink-0">{icon}</span>
                    <span className="text-xs text-main font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={[
                "max-w-2xl mx-auto",
                msg.role === "user" ? "flex justify-end" : "flex justify-start",
              ].join(" ")}
            >
              {/* Avatar asistente */}
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-sm shrink-0 mr-3 mt-1">
                  🦅
                </div>
              )}

              <div className={[
                "max-w-[85%] rounded-2xl px-4 py-3",
                msg.role === "user"
                  ? "bg-violet-600 text-white"
                  : "bg-card-theme border border-soft",
              ].join(" ")}>
                {/* Loading */}
                {msg.loading ? (
                  <div className="flex items-center gap-2 text-sub">
                    <span className="w-4 h-4 border-2 border-soft border-t-violet-500 rounded-full animate-spin" />
                    <span className="text-sm">Pensando...</span>
                  </div>
                ) : (
                  <>
                    <div
                      className="text-sm leading-relaxed prose-sm"
                      dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }}
                    />

                    {/* Metadata del proveedor */}
                    {msg.role === "assistant" && msg.provider && msg.provider !== "Sistema" && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-semibold ${providerColor(msg.provider)}`}>
                          ⚡ {msg.provider}
                        </span>
                        {msg.model && (
                          <span className="text-[10px] text-muted2 font-mono truncate max-w-[120px]">
                            {msg.model}
                          </span>
                        )}
                        {msg.latencyMs && (
                          <span className="text-[10px] text-muted2">
                            {msg.latencyMs}ms
                          </span>
                        )}
                        {msg.task && msg.task !== "general" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-card-soft-theme text-sub border border-soft">
                            {msg.task}
                          </span>
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
        <div className="border-t border-soft bg-card-theme p-4 shrink-0">
          <div className="max-w-2xl mx-auto">
            {/* Indicador de tarea activa */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-sub">Modo:</span>
              {TASK_OPTIONS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTask(t.value)}
                  className={[
                    "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                    task === t.value
                      ? "border-violet-500/40 bg-violet-500/15 text-violet-600"
                      : "border-soft text-sub hover:text-main",
                  ].join(" ")}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe aquí... (Enter para enviar, Shift+Enter para nueva línea)"
                rows={2}
                disabled={loading}
                className="flex-1 resize-none rounded-2xl border border-soft bg-card-soft-theme px-4 py-3 text-sm text-main placeholder:text-sub focus:outline-none focus:border-violet-500/40 disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="shrink-0 h-[52px] w-12 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <span className="text-lg">↑</span>
                }
              </button>
            </div>

            <p className="mt-2 text-center text-[10px] text-muted2">
              Powered by Groq · Gemini Flash · Kimi K2 · Cerebras — todos gratuitos
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
