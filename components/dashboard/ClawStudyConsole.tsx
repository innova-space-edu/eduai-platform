"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Bot,
  BookOpen,
  FileQuestion,
  ImageIcon,
  Loader2,
  PenLine,
  Plus,
  Send,
  Sparkles,
} from "lucide-react"

type Role = "user" | "assistant"
type Message = { role: Role; content: string }
type Suggestion = { label: string; href: string; emoji: string }

type Props = {
  displayName?: string
  isAdmin?: boolean
}

const CREATE_ACTIONS = [
  {
    label: "Estudiar un tema",
    icon: BookOpen,
    prompt: "Inicia una sesión de estudio sobre ",
    hint: "Explicar, practicar y evaluar",
  },
  {
    label: "Crear prueba",
    icon: FileQuestion,
    prompt: "Ayúdame a crear una evaluación con preguntas variadas sobre ",
    hint: "Alternativas, desarrollo y rúbrica",
  },
  {
    label: "Crear imagen",
    icon: ImageIcon,
    prompt: "Genera una imagen educativa sobre ",
    hint: "Material visual educativo",
  },
  {
    label: "Planificar clase",
    icon: PenLine,
    prompt: "Ayúdame a planificar una clase sobre ",
    hint: "Inicio, desarrollo y cierre",
  },
]

const EDUAI_SHORTCUTS = [
  { label: "Creator Hub", href: "/creator-hub", emoji: "🚀", hint: "Crear materiales" },
  { label: "Crear examen", href: "/examen/crear", emoji: "📝", hint: "Evaluaciones completas" },
  { label: "QR Studio", href: "/qr-studio", emoji: "▦", hint: "Códigos QR" },
  { label: "Image Studio", href: "/image-studio", emoji: "🎨", hint: "Imágenes educativas" },
  { label: "Chat Paper", href: "/paper", emoji: "📄", hint: "Trabajar con documentos" },
  { label: "Audio Lab", href: "/audio-lab", emoji: "🎙️", hint: "Audio y voz" },
]

function renderInlineContent(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g)

  return parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const href = link[2]
      if (href.startsWith("/")) {
        return (
          <Link
            key={index}
            href={href}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700 hover:bg-violet-200"
          >
            {link[1]} <ArrowRight size={11} />
          </Link>
        )
      }
      return (
        <a key={index} href={href} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline underline-offset-2">
          {link[1]}
        </a>
      )
    }

    const bold = part.match(/^\*\*([^*]+)\*\*$/)
    if (bold) return <strong key={index} className="font-semibold text-main">{bold[1]}</strong>

    const italic = part.match(/^\*([^*\n]+)\*$/)
    if (italic) return <em key={index}>{italic[1]}</em>

    const code = part.match(/^`([^`]+)`$/)
    if (code) return <code key={index} className="rounded-md bg-black/5 px-1.5 py-0.5 text-[0.92em]">{code[1]}</code>

    return <span key={index}>{part.replace(/\*\*/g, "").replace(/__/g, "")}</span>
  })
}

function renderContent(text: string) {
  const lines = String(text || "").replace(/\r/g, "").split("\n")

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={`space-${index}`} className="h-1" />

        const heading = trimmed.match(/^#{1,4}\s+(.+)$/)
        if (heading) {
          return (
            <p key={index} className="pt-1 font-bold text-main">
              {renderInlineContent(heading[1])}
            </p>
          )
        }

        const bullet = trimmed.match(/^[-*•]\s+(.+)$/)
        if (bullet) {
          return (
            <div key={index} className="flex items-start gap-2">
              <span className="mt-[1px] shrink-0 text-blue-600">•</span>
              <span className="min-w-0">{renderInlineContent(bullet[1])}</span>
            </div>
          )
        }

        const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)$/)
        if (numbered) {
          return (
            <div key={index} className="flex items-start gap-2">
              <span className="shrink-0 font-semibold text-blue-700">{numbered[1]}.</span>
              <span className="min-w-0">{renderInlineContent(numbered[2])}</span>
            </div>
          )
        }

        return <p key={index}>{renderInlineContent(line)}</p>
      })}
    </div>
  )
}

export default function ClawStudyConsole({ displayName = "Estudiante", isAdmin = false }: Props) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hola ${displayName} 👋 Soy Claw. Podemos conversar con naturalidad, resolver una duda, pensar una idea, organizar algo o trabajar con las herramientas de EduAI. ¿Qué tienes en mente?`,
    },
  ])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  const contextualPrompt = useMemo(() => {
    if (isAdmin) return "Claw está disponible para conversar contigo y, cuando lo necesites, usar herramientas de administración y creación."
    return "Claw puede conversar contigo, ayudarte a pensar y también usar herramientas de EduAI cuando tú se lo pidas."
  }, [isAdmin])

  useEffect(() => {
    const transcript = transcriptRef.current
    if (!transcript) return
    requestAnimationFrame(() => {
      transcript.scrollTop = transcript.scrollHeight
    })
  }, [messages, loading, suggestions])

  const send = async (override?: string) => {
    const text = String(override ?? input).trim()
    if (!text || loading) return

    setInput("")
    setToolsOpen(false)
    setSuggestions([])
    const nextMessages: Message[] = [...messages, { role: "user", content: text }]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const response = await fetch("/api/agents/claw-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextMessages.slice(-14),
          pageContext: {
            pathname: "/dashboard",
            pageTitle: "Conversación principal con Claw",
            mode: isAdmin ? "admin" : "student",
            availableActions: [
              "start_study_session",
              "generate_exam_questions",
              "generate_image",
              "plan_curriculum",
              "navigate_to_page",
            ],
          },
          userName: displayName,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "No se pudo responder")

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Listo." }])
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error instanceof Error ? `No pude completar la acción: ${error.message}` : "No pude completar la acción.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAction = (prompt: string) => {
    setInput(prompt)
    setToolsOpen(false)
    setTimeout(() => inputRef.current?.focus(), 60)
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-soft bg-card-theme shadow-sm animate-fade-in">
      <div className="shrink-0 flex items-start justify-between gap-4 border-b border-soft px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20">
            <Bot size={19} />
          </div>
          <div>
            <h1 className="text-main text-lg font-black">Claw — Superagente EduAI</h1>
            <p className="text-muted2 mt-0.5 text-xs leading-relaxed">
              Conversa, pregunta, crea o simplemente habla con Claw.
            </p>
          </div>
        </div>
        <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 sm:inline-flex">
          activo
        </span>
      </div>

      <div
        ref={transcriptRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-app/40 px-4 py-5 sm:px-6"
      >
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50/70 px-3 py-2 text-xs text-violet-800">
          <Sparkles size={13} className="shrink-0" />
          <span>{contextualPrompt}</span>
        </div>

        <div className="mx-auto w-full max-w-3xl space-y-4">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${
                  message.role === "user"
                    ? "rounded-br-lg bg-blue-600 text-white"
                    : "rounded-bl-lg border border-soft bg-card-soft-theme text-main"
                }`}
              >
                {message.role === "assistant" ? renderContent(message.content) : <p className="whitespace-pre-wrap">{message.content}</p>}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-3xl rounded-bl-lg border border-soft bg-card-soft-theme px-4 py-3 text-xs text-muted2 shadow-sm">
                <Loader2 size={14} className="animate-spin" /> Claw está pensando...
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Link
                  key={`${suggestion.href}-${suggestion.label}`}
                  href={suggestion.href}
                  className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-700 hover:bg-violet-100"
                >
                  {suggestion.emoji} {suggestion.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relative shrink-0 border-t border-soft bg-card-theme px-3 py-3 sm:px-5 sm:py-4">
        {toolsOpen && (
          <div className="absolute bottom-[calc(100%-4px)] left-4 z-30 w-[min(360px,calc(100vw-110px))] overflow-hidden rounded-3xl border border-soft bg-card-theme p-2 shadow-2xl sm:left-6">
            <div className="px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted2">Crear con Claw</div>
            <div className="grid gap-1">
              {CREATE_ACTIONS.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => handleCreateAction(action.prompt)}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-blue-50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-main text-sm font-bold">{action.label}</p>
                      <p className="text-muted2 text-[11px]">{action.hint}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="my-2 border-t border-soft" />
            <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted2">Herramientas EduAI</div>
            <div className="grid grid-cols-2 gap-1">
              {EDUAI_SHORTCUTS.map((shortcut) => (
                <Link
                  key={shortcut.href}
                  href={shortcut.href}
                  onClick={() => setToolsOpen(false)}
                  className="rounded-2xl px-3 py-2.5 transition hover:bg-violet-50"
                >
                  <div className="text-sm font-bold text-main">{shortcut.emoji} {shortcut.label}</div>
                  <div className="mt-0.5 text-[10px] text-muted2">{shortcut.hint}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto w-full max-w-3xl rounded-[1.7rem] border border-soft bg-card-soft-theme p-2 shadow-sm transition focus-within:border-blue-200 focus-within:shadow-md">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
            rows={2}
            placeholder="Escribe lo que quieras: una pregunta, una idea, algo que te preocupa o una tarea para Claw..."
            className="min-h-[64px] max-h-32 w-full resize-none overflow-y-auto bg-transparent px-3 py-2 text-sm text-main outline-none placeholder:text-muted2"
            disabled={loading}
          />

          <div className="flex items-center justify-between gap-2 border-t border-soft px-1 pt-2">
            <button
              type="button"
              onClick={() => setToolsOpen((open) => !open)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                toolsOpen
                  ? "rotate-45 border-blue-200 bg-blue-50 text-blue-700"
                  : "border-soft bg-card-theme text-main hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              }`}
              aria-label="Abrir opciones para crear materiales"
              title="Crear materiales y abrir herramientas"
            >
              <Plus size={20} />
            </button>

            <button
              type="button"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
