"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"

type Msg = { role: "user" | "assistant"; content: string }
type Suggestion = { label: string; href: string; emoji: string }

function StatusDot({ online }: { online: boolean }) {
  return (
    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${online
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
      : "bg-slate-200"}`} />
  )
}

// Render markdown links inline: [text](href)
function MsgContent({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g)
  return (
    <span className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((p, i) => {
        const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (m) return (
          <Link key={i} href={m[2]}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 font-medium text-xs transition mx-0.5">
            {m[1]} →
          </Link>
        )
        return <span key={i}>{p}</span>
      })}
    </span>
  )
}

export default function SuperAgentButton() {
  const [open, setOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Check if Claw is online
  useEffect(() => {
    fetch("/api/superagent", { cache: "no-store" })
      .then(r => r.json())
      .then(d => setIsOnline(d.ok))
      .catch(() => setIsOnline(false))
  }, [])

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "¡Hola! Soy Claw 👋 Tu asistente en EduAI. Puedo ayudarte con lo que necesites — trabajo, ideas, dudas, o llevarte directo al agente que más te sirva. ¿En qué andas hoy?"
      }])
    }
  }, [open, messages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput("")
    setSuggestions([])

    const newMsgs: Msg[] = [...messages, { role: "user", content: msg }]
    setMessages(newMsgs)
    setLoading(true)

    try {
      const res = await fetch("/api/agents/claw-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: newMsgs.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (data.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }])
        if (data.suggestions?.length) setSuggestions(data.suggestions)
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Ups, algo falló. Intenta de nuevo 🔁" }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {/* Chat panel */}
      {open && (
        <div className="w-[340px] sm:w-[380px] rounded-3xl border border-soft bg-app shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: "min(560px, 80vh)" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-soft bg-gradient-to-r from-violet-500/8 via-cyan-500/6 to-transparent flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">C</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-main leading-none">Claw</p>
              <p className="text-[11px] text-muted2 mt-0.5 flex items-center gap-1">
                <StatusDot online={isOnline} />
                {isOnline ? "activo" : "pausado"}
              </p>
            </div>
            <button onClick={() => setMessages([])}
              className="text-[10px] text-muted2 hover:text-sub px-2 py-1 rounded-lg hover:bg-card-soft-theme transition"
              title="Limpiar chat">↺</button>
            <button onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-xl text-muted2 hover:text-main hover:bg-card-soft-theme transition">×</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                {m.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold mt-0.5">C</div>
                )}
                <div className={`max-w-[82%] rounded-2xl px-3 py-2.5 ${m.role === "user"
                  ? "bg-blue-600 text-white rounded-tr-sm"
                  : "bg-card-soft-theme text-main rounded-tl-sm"}`}>
                  {m.role === "assistant"
                    ? <MsgContent text={m.content} />
                    : <span className="text-sm">{m.content}</span>}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold">C</div>
                <div className="bg-card-soft-theme rounded-2xl rounded-tl-sm px-3 py-2.5 flex gap-1 items-center">
                  {[0,120,240].map(d => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}

            {/* Agent suggestions */}
            {suggestions.length > 0 && !loading && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {suggestions.map(s => (
                  <Link key={s.href} href={s.href} onClick={() => setOpen(false)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-violet-200 bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100 transition">
                    {s.emoji} {s.label} →
                  </Link>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-3 py-3 border-t border-soft bg-app">
            <div className="flex items-end gap-2 bg-card-soft-theme rounded-2xl px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                disabled={loading}
                placeholder="Escríbeme lo que necesitas..."
                className="flex-1 bg-transparent text-sm text-main outline-none resize-none placeholder-gray-400 disabled:opacity-40 max-h-28"
              />
              <button onClick={() => send()} disabled={loading || !input.trim()}
                className="flex-shrink-0 w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-30 flex items-center justify-center transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-muted2 mt-1.5 text-center">Enter para enviar · Shift+Enter para nueva línea</p>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(p => !p)}
        className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
        title="Claw — Asistente EduAI"
      >
        {open
          ? <span className="text-white text-xl font-bold">×</span>
          : <span className="text-2xl">✦</span>}
        <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full border-2 border-white">
          <StatusDot online={isOnline} />
        </span>
      </button>
    </div>
  )
}
