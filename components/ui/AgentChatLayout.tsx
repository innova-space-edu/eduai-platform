/**
 * components/ui/AgentChatLayout.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Layout reutilizable para páginas de chat de agentes IA.
 * Usado por: Redactor, Investigador, Matemático, Traductor, Educador, Paper.
 *
 * Exporta además:
 *   - UserBubble     → burbuja del usuario (derecha)
 *   - AgentBubble    → burbuja del agente  (izquierda)
 *   - QuickPrompts   → grid de prompts rápidos
 *   - ChatInput      → textarea + botón enviar con sticky bottom
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use client"

import { useRef } from "react"

// ── AgentChatLayout ───────────────────────────────────────────────────────────
interface LayoutProps {
  header:       React.ReactNode
  welcome?:     React.ReactNode
  messages:     React.ReactNode
  input:        React.ReactNode
  loading?:     boolean
  accentColor?: string
}

export default function AgentChatLayout({
  header, welcome, messages, input, loading = false, accentColor = "#3b82f6",
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-app flex flex-col">
      {/* Header fijo arriba */}
      {header}

      {/* Área scrolleable */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 flex flex-col gap-4 pb-2">
        {welcome}
        {messages}

        {/* Spinner de "pensando" */}
        {loading && (
          <div className="flex items-center gap-3 px-1 py-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}25` }}
            >
              <span className="text-sm">✦</span>
            </div>
            <div className="flex gap-1.5 items-center">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: `${accentColor}80`, animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input sticky abajo */}
      <div className="sticky bottom-0 border-t backdrop-blur-xl" style={{ background: "var(--bg-header)", borderColor: "var(--border-soft)" }}>
        <div className="max-w-3xl mx-auto px-4 py-3">
          {input}
        </div>
      </div>
    </div>
  )
}

// ── UserBubble ────────────────────────────────────────────────────────────────
export function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3"
        style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.3)" }}
      >
        <p className="text-main text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  )
}

// ── AgentBubble ───────────────────────────────────────────────────────────────
export function AgentBubble({
  icon, accentColor = "#3b82f6", children,
}: {
  icon: string
  accentColor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3 items-start">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 mt-1"
        style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}25` }}
      >
        {icon}
      </div>
      <div
        className="flex-1 rounded-2xl rounded-tl-sm px-4 py-3"
        style={{ background: "var(--bg-input)", border: "1px solid var(--border-soft)" }}
      >
        {children}
      </div>
    </div>
  )
}

// ── QuickPrompts ──────────────────────────────────────────────────────────────
export function QuickPrompts({
  prompts,
  onSelect,
  cols = 3,
  accentColor = "#3b82f6",
}: {
  prompts:      { icon: string; label: string; prompt: string }[]
  onSelect:     (prompt: string) => void
  cols?:        2 | 3
  accentColor?: string
}) {
  return (
    <div className={`grid gap-2 ${cols === 3 ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2"}`}>
      {prompts.map(q => (
        <button
          key={q.label}
          onClick={() => onSelect(q.prompt)}
          className="flex items-start gap-2.5 p-3 rounded-2xl border text-left transition-all"
          style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.background  = `${accentColor}0c`
            ;(e.currentTarget as HTMLElement).style.borderColor = `${accentColor}25`
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.background  = "var(--bg-card-soft)"
            ;(e.currentTarget as HTMLElement).style.borderColor = "var(--bg-card-soft)"
          }}
        >
          <span className="text-lg flex-shrink-0">{q.icon}</span>
          <span className="text-muted2 text-xs leading-snug mt-0.5">{q.label}</span>
        </button>
      ))}
    </div>
  )
}

// ── ChatInput ─────────────────────────────────────────────────────────────────
export function ChatInput({
  value,
  onChange,
  onSend,
  loading,
  placeholder,
  accentColor = "#3b82f6",
  extra,
}: {
  value:        string
  onChange:     (v: string) => void
  onSend:       () => void
  loading:      boolean
  placeholder:  string
  accentColor?: string
  extra?:       React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Slot para contenido extra encima del input (ej: selector de idioma) */}
      {extra}

      <div className="flex gap-2 items-end">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder={placeholder}
          rows={1}
           disabled={loading}
          className="flex-1 rounded-2xl px-4 py-3 text-sm focus:outline-none transition-all resize-none disabled:opacity-50 text-main placeholder-gray-400"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-medium)",
            minHeight: "48px",
            maxHeight: "140px",
          }}
          onInput={e => {
            const el = e.target as HTMLTextAreaElement
            el.style.height = "auto"
            el.style.height = Math.min(el.scrollHeight, 140) + "px"
          }}
        />
        <button
          onClick={onSend}
          disabled={loading || !value.trim()}
          className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-main transition-all disabled:opacity-40"
          style={{
            background: value.trim() && !loading ? accentColor : "var(--bg-card-soft)",
            boxShadow:  value.trim() && !loading ? `0 4px 12px ${accentColor}40` : "none",
          }}
        >
          {loading
            ? <span className="w-4 h-4 rounded-full border-2 border-soft border-t-white animate-spin" />
            : <span className="text-base">↑</span>
          }
        </button>
      </div>
    </div>
  )
}
