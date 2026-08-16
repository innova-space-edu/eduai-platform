"use client"

import Link from "next/link"
import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  Bot,
  Mic2,
  Send,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  provider?: string | null
  model?: string | null
  reused?: boolean
}

type ApiResponse = {
  ok: boolean
  message?: string
  provider?: string
  model?: string
  reused?: boolean
  generationAvoided?: boolean
  error?: string
  code?: string
}

const STARTERS = [
  "Ayúdame a organizar lo que tengo que hacer hoy.",
  "Explícame un tema difícil paso a paso.",
  "Quiero preparar una clase o actividad.",
  "Ayúdame a mejorar un texto o una idea.",
]

const MODULES = [
  { href: "/chat-global", label: "Open EDUAI Work", detail: "investigar y ejecutar con agentes" },
  { href: "/paper", label: "Chat Paper", detail: "conversar con un PDF" },
  { href: "/image-studio", label: "Image Studio", detail: "crear o reutilizar imágenes" },
  { href: "/video-studio", label: "Video Studio", detail: "crear o reutilizar videos" },
]

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

export default function MiraAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, loading])

  useEffect(() => {
    return () => {
      if (canSpeak()) window.speechSynthesis.cancel()
    }
  }, [])

  const history = useMemo(
    () => messages.slice(-12).map((message) => ({ role: message.role, content: message.content })),
    [messages],
  )

  function stopSpeaking() {
    if (!canSpeak()) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  function speak(text: string) {
    if (!canSpeak() || !text.trim()) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text.replace(/[`*_#>|]/g, " "))
    utterance.lang = "es-CL"
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  async function send(raw?: string) {
    const message = (raw ?? input).trim()
    if (!message || loading) return

    const userMessage: ChatMessage = { id: id(), role: "user", content: message }
    const previousHistory = history
    setMessages((current) => [...current, userMessage])
    setInput("")
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/agents/mira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: previousHistory }),
      })
      const body = (await response.json().catch(() => null)) as ApiResponse | null
      if (!response.ok || !body?.ok || !body.message) {
        throw new Error(body?.error || "MIRA no pudo responder")
      }

      const assistantMessage: ChatMessage = {
        id: id(),
        role: "assistant",
        content: body.message,
        provider: body.provider || null,
        model: body.model || null,
        reused: Boolean(body.reused || body.generationAvoided),
      }
      setMessages((current) => [...current, assistantMessage])
      if (autoSpeak) speak(body.message)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "MIRA no pudo responder")
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void send()
  }

  return (
    <div className="grid min-h-[calc(100dvh-7rem)] gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="flex min-h-[680px] flex-col overflow-hidden rounded-[30px] border border-white/10 bg-slate-950/70 shadow-2xl">
        <header className="border-b border-white/10 bg-gradient-to-r from-violet-500/10 via-cyan-500/10 to-emerald-500/10 px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">MIRA · EduAI</p>
                <h1 className="mt-1 text-2xl font-black text-white">Asistente general</h1>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-300">
                  Conversa, organiza, explica y decide qué herramienta de EduAI usar. MIRA no finge ejecutar acciones que todavía no están conectadas.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (speaking) stopSpeaking()
                  setAutoSpeak((value) => !value)
                }}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${autoSpeak ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5 text-slate-300"}`}
              >
                {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                Leer respuestas
              </button>
              <Link
                href="/traductor"
                className="inline-flex items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-xs font-bold text-violet-200 hover:bg-violet-400/15"
              >
                <Mic2 className="h-4 w-4" />
                Voz en vivo
              </Link>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-7">
          {!messages.length ? (
            <div className="mx-auto flex min-h-[430px] max-w-3xl flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
                <Bot className="h-8 w-8" />
              </div>
              <h2 className="mt-5 text-xl font-black text-white">¿Qué necesitas hacer?</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                Esta conversación vive en la sesión de la página. MIRA usa AI Core y no necesita que pegues API keys en el navegador.
              </p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => void send(starter)}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left text-sm font-semibold text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-400/[0.06]"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <article className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === "user" ? "bg-cyan-500 text-slate-950" : "border border-white/10 bg-white/[0.045] text-slate-100"}`}>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.role === "assistant" ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2 text-[10px] text-slate-500">
                        {message.provider ? <span>{message.provider}{message.model ? ` · ${message.model}` : ""}</span> : null}
                        {message.reused ? <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-emerald-300">reutilizado</span> : null}
                        <button type="button" onClick={() => speak(message.content)} className="ml-auto inline-flex items-center gap-1 text-slate-400 hover:text-white">
                          <Volume2 className="h-3 w-3" /> escuchar
                        </button>
                      </div>
                    ) : null}
                  </article>
                </div>
              ))}
              {loading ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-slate-400">MIRA está pensando…</div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="border-t border-white/10 bg-slate-950/90 p-4 sm:p-5">
          {error ? <div className="mb-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
          <form onSubmit={onSubmit} className="mx-auto flex max-w-4xl items-end gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, 6000))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
              rows={2}
              placeholder="Escribe a MIRA…"
              className="min-h-[54px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Enviar a MIRA"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
          {speaking ? (
            <div className="mx-auto mt-2 flex max-w-4xl justify-end">
              <button type="button" onClick={stopSpeaking} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white">
                <Square className="h-3 w-3" /> detener voz
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-[26px] border border-white/10 bg-slate-950/70 p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Herramientas conectadas</p>
          <div className="mt-4 space-y-2">
            {MODULES.map((item) => (
              <Link key={item.href} href={item.href} className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 hover:bg-white/[0.06]">
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-white">{item.label}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">{item.detail}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[26px] border border-emerald-400/15 bg-emerald-500/[0.06] p-5">
          <p className="text-sm font-black text-emerald-200">Voz de MIRA</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            “Leer respuestas” usa la voz del navegador y no consume otra generación de IA. El modo voz en vivo del Traductor conserva STT, traducción y conversación hablada.
          </p>
          <Link href="/traductor" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-emerald-200 hover:text-emerald-100">
            Abrir voz en vivo <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      </aside>
    </div>
  )
}
